import { isAddress, getAddress, decodeEventLog, type Hex } from "viem";
import type { LlmToolSchema } from "../llm/index.js";
import { listingHash, type ChainClients } from "../chain.js";
import { policyVaultAbi, mockUsdcAbi } from "@safespend/contracts/abi";
import { resolveEns } from "../ens.js";

export const proposePurchaseSchema: LlmToolSchema = {
  name: "proposePurchase",
  description:
    "Propose a purchase from a merchant. The wallet decides whether the purchase actually executes; the agent's job is just to propose the transaction. Use the listingId returned by searchListings.",
  parameters: {
    type: "object",
    properties: {
      merchant: {
        type: "string",
        description:
          "Merchant identifier — either an EVM address (0x...) or an ENS name (e.g. vitalik.eth). ENS names are resolved against Ethereum mainnet before the on-chain call.",
      },
      amount: {
        type: "string",
        description:
          "Amount in MockUSDC base units (6 decimals). e.g. '22000000' for 22.00 USDC.",
      },
      listingId: { type: "string", description: "Stable id from searchListings" },
    },
    required: ["merchant", "amount", "listingId"],
    additionalProperties: false,
  },
};

export type ProposePurchaseMode = "safe" | "vulnerable";

export type ProposePurchaseDeps = {
  mode: ProposePurchaseMode;
  clients: ChainClients;
  vaultAddress: Hex;
  usdcAddress: Hex;
  userAddress: Hex;
};

export async function proposePurchase(
  args: { merchant: string; amount: string; listingId: string },
  deps: ProposePurchaseDeps,
): Promise<string> {
  // ---- Input validation (hard guardrails per spec) ----
  if (typeof args.merchant !== "string" || args.merchant.length === 0) {
    return JSON.stringify({ ok: false, error: "invalid_merchant" });
  }

  // Resolve ENS names to addresses. Hex addresses pass through unchanged.
  let merchant: Hex;
  let merchantEns: string | undefined;
  if (isAddress(args.merchant)) {
    merchant = getAddress(args.merchant);
  } else if (args.merchant.includes(".") && !args.merchant.startsWith("0x")) {
    const resolved = await resolveEns(args.merchant);
    if (!resolved) {
      return JSON.stringify({
        ok: false,
        error: "ens_resolution_failed",
        ensName: args.merchant,
      });
    }
    merchant = resolved;
    merchantEns = args.merchant;
  } else {
    return JSON.stringify({ ok: false, error: "invalid_merchant_address" });
  }

  if (typeof args.amount !== "string" || !/^[0-9]+$/.test(args.amount)) {
    return JSON.stringify({ ok: false, error: "amount_must_be_decimal_string" });
  }
  let amount: bigint;
  try {
    amount = BigInt(args.amount);
  } catch {
    return JSON.stringify({ ok: false, error: "amount_not_parseable" });
  }
  if (amount <= 0n) {
    return JSON.stringify({ ok: false, error: "amount_must_be_positive" });
  }
  if (amount >= 1n << 256n) {
    return JSON.stringify({ ok: false, error: "amount_overflow_uint256" });
  }
  if (typeof args.listingId !== "string" || args.listingId.length === 0) {
    return JSON.stringify({ ok: false, error: "listing_id_required" });
  }

  const hash = listingHash(merchant, amount, args.listingId);

  if (deps.mode === "vulnerable") {
    return await runVulnerable({ ...deps, merchant, amount, merchantEns });
  }
  return await runSafe({ ...deps, merchant, amount, hash, merchantEns });
}

// -------------- Safe path: PolicyVault.tryProposePurchase --------------

async function runSafe(p: {
  clients: ChainClients;
  vaultAddress: Hex;
  userAddress: Hex;
  merchant: Hex;
  merchantEns?: string;
  amount: bigint;
  hash: Hex;
}): Promise<string> {
  const { clients, vaultAddress, userAddress, merchant, merchantEns, amount, hash } = p;
  const account = clients.account;
  // Simulate first to surface UnauthorizedAgent (a hard revert) without
  // burning gas; expected rejections stay within the call as events.
  try {
    await clients.publicClient.simulateContract({
      address: vaultAddress,
      abi: policyVaultAbi,
      functionName: "tryProposePurchase",
      args: [userAddress, merchant, amount, hash],
      account,
    });
  } catch (err) {
    return JSON.stringify({
      ok: false,
      error: "vault_reverted",
      detail: errMsg(err),
    });
  }

  const txHash = await clients.walletClient.writeContract({
    address: vaultAddress,
    abi: policyVaultAbi,
    functionName: "tryProposePurchase",
    args: [userAddress, merchant, amount, hash],
    account,
    chain: clients.chain,
  });

  const receipt = await clients.publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 30_000,
  });

  // Decode the Approved/Rejected event from the receipt logs.
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== vaultAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: policyVaultAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "PurchaseApproved") {
        return JSON.stringify({
          ok: true,
          mode: "safe",
          status: "approved",
          merchant,
          merchantEns,
          amount: amount.toString(),
          txHash,
        });
      }
      if (decoded.eventName === "PurchaseRejected") {
        return JSON.stringify({
          ok: false,
          mode: "safe",
          status: "rejected",
          reason: decoded.args.reason,
          merchant,
          merchantEns,
          amount: amount.toString(),
          txHash,
        });
      }
    } catch {
      // not one of our events
    }
  }
  return JSON.stringify({
    ok: false,
    mode: "safe",
    status: "no_event",
    txHash,
  });
}

// -------------- Vulnerable path: MockUSDC.transfer from session wallet --

async function runVulnerable(p: {
  clients: ChainClients;
  usdcAddress: Hex;
  merchant: Hex;
  merchantEns?: string;
  amount: bigint;
}): Promise<string> {
  const { clients, usdcAddress, merchant, merchantEns, amount } = p;
  const account = clients.account;

  try {
    await clients.publicClient.simulateContract({
      address: usdcAddress,
      abi: mockUsdcAbi,
      functionName: "transfer",
      args: [merchant, amount],
      account,
    });
  } catch (err) {
    return JSON.stringify({
      ok: false,
      mode: "vulnerable",
      status: "reverted",
      detail: errMsg(err),
    });
  }

  const txHash = await clients.walletClient.writeContract({
    address: usdcAddress,
    abi: mockUsdcAbi,
    functionName: "transfer",
    args: [merchant, amount],
    account,
    chain: clients.chain,
  });
  await clients.publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 30_000,
  });

  return JSON.stringify({
    ok: true,
    mode: "vulnerable",
    status: "transferred",
    merchant,
    merchantEns,
    amount: amount.toString(),
    txHash,
  });
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message.split("\n")[0] ?? err.message;
  return String(err);
}
