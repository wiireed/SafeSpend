/// LLM tool wrapper around the SDK's safe-spend primitive. Validates raw
/// LLM-supplied arguments, resolves ENS where needed, and routes to either
/// the SDK's proposePurchase (safe path) or a direct MockUSDC.transfer
/// (vulnerable path — kept here intentionally as the anti-pattern half of
/// the dual-lane demo).

import { isAddress, getAddress, type Hex } from "viem";
import {
  computeListingHash,
  type VaultClients,
} from "@safespend/sdk/chain";
import { resolveEns } from "@safespend/sdk/ens";
import { proposePurchase as proposePurchaseSafe } from "@safespend/sdk/spend";
import { mockUsdcAbi } from "@safespend/contracts/abi";
import type { LlmToolSchema } from "../llm/index.js";

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
  clients: VaultClients;
  vaultAddress: Hex;
  usdcAddress: Hex;
  userAddress: Hex;
};

export async function proposePurchase(
  args: { merchant: string; amount: string; listingId: string },
  deps: ProposePurchaseDeps,
): Promise<string> {
  if (typeof args.merchant !== "string" || args.merchant.length === 0) {
    return JSON.stringify({ ok: false, error: "invalid_merchant" });
  }

  let merchant: Hex;
  let merchantEns: string | undefined;
  if (isAddress(args.merchant)) {
    merchant = getAddress(args.merchant);
  } else if (args.merchant.includes(".") && !args.merchant.startsWith("0x")) {
    const resolved = await resolveEns(args.merchant, {
      rpcUrl: process.env.MAINNET_RPC_URL,
    });
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

  const listingHash = computeListingHash({ merchant, amount, listingId: args.listingId });

  if (deps.mode === "vulnerable") {
    return runVulnerable({ ...deps, merchant, amount, merchantEns });
  }

  const result = await proposePurchaseSafe({
    clients: deps.clients,
    vaultAddress: deps.vaultAddress,
    userAddress: deps.userAddress,
    merchant,
    amount,
    listingHash,
  });

  return JSON.stringify(formatSafeResult(result, { merchant, merchantEns, amount }));
}

function formatSafeResult(
  result: Awaited<ReturnType<typeof proposePurchaseSafe>>,
  ctx: { merchant: Hex; merchantEns?: string; amount: bigint },
): Record<string, unknown> {
  const base = {
    mode: "safe" as const,
    merchant: ctx.merchant,
    merchantEns: ctx.merchantEns,
    amount: ctx.amount.toString(),
  };
  if (result.status === "approved") return { ok: true, status: "approved", ...base, txHash: result.txHash };
  if (result.status === "rejected")
    return { ok: false, status: "rejected", reason: result.reason, ...base, txHash: result.txHash };
  if (result.status === "reverted")
    return { ok: false, error: "vault_reverted", detail: result.detail };
  return { ok: false, status: "no_event", ...base, txHash: result.txHash };
}

// -------------- Vulnerable path: MockUSDC.transfer from session wallet --
// Intentionally kept inline here, not in the SDK. This is the anti-pattern
// half of the demo — the agent calling USDC.transfer directly bypasses the
// vault entirely. @safespend/sdk only ships the safe primitive.

async function runVulnerable(p: {
  clients: VaultClients;
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
