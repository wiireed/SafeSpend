/// Vault-side spend primitives — preflight simulation, propose-purchase
/// transaction, and event decoding. All inputs are explicit (vault address,
/// user address, computed listing hash); callers do their own validation
/// and ENS resolution before reaching here.

import {
  decodeEventLog,
  type Hex,
  type Log,
} from "viem";
import { policyVaultAbi } from "@safespend/contracts/abi";
import type { VaultClients } from "./chain.js";

export type ProposePurchaseArgs = {
  clients: VaultClients;
  vaultAddress: Hex;
  userAddress: Hex;
  merchant: Hex;
  amount: bigint;
  listingHash: Hex;
};

export type PreflightResult = { ok: true } | { ok: false; detail: string };

export type ProposeResult =
  | { ok: true; status: "approved"; txHash: Hex }
  | { ok: false; status: "rejected"; reason: string; txHash: Hex }
  | { ok: false; status: "reverted"; detail: string }
  | { ok: false; status: "no_event"; txHash: Hex };

export type VaultEvent =
  | {
      eventName: "PurchaseApproved";
      args: {
        user: Hex;
        merchant: Hex;
        amount: bigint;
        listingHash: Hex;
        policyVersion: bigint;
      };
    }
  | {
      eventName: "PurchaseRejected";
      args: {
        user: Hex;
        merchant: Hex;
        amount: bigint;
        listingHash: Hex;
        reasonCode: Hex;
        reason: string;
      };
    };

/// Simulates `tryProposePurchase` against the vault. Surfaces
/// hard-revert paths (e.g. UnauthorizedAgent) without spending gas.
/// Soft rejections (per-tx limit, total budget, etc.) emit
/// `PurchaseRejected` events at runtime; this returns ok in that case.
export async function simulateProposePurchase(
  args: ProposePurchaseArgs,
): Promise<PreflightResult> {
  try {
    await args.clients.publicClient.simulateContract({
      address: args.vaultAddress,
      abi: policyVaultAbi,
      functionName: "tryProposePurchase",
      args: [args.userAddress, args.merchant, args.amount, args.listingHash],
      account: args.clients.account,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: errMsg(err) };
  }
}

/// Sends a `tryProposePurchase` transaction, waits for the receipt, and
/// decodes the resulting `PurchaseApproved` or `PurchaseRejected` event
/// into a structured result. Reverts (hard guardrails) are caught and
/// returned as `status: "reverted"`.
export async function proposePurchase(
  args: ProposePurchaseArgs,
): Promise<ProposeResult> {
  const sim = await simulateProposePurchase(args);
  if (!sim.ok) return { ok: false, status: "reverted", detail: sim.detail };

  const txHash = await args.clients.walletClient.writeContract({
    address: args.vaultAddress,
    abi: policyVaultAbi,
    functionName: "tryProposePurchase",
    args: [args.userAddress, args.merchant, args.amount, args.listingHash],
    account: args.clients.account,
    chain: args.clients.chain,
  });

  const receipt = await args.clients.publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 30_000,
  });

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== args.vaultAddress.toLowerCase()) continue;
    const event = decodeVaultEvent(log);
    if (event?.eventName === "PurchaseApproved") {
      return { ok: true, status: "approved", txHash };
    }
    if (event?.eventName === "PurchaseRejected") {
      return {
        ok: false,
        status: "rejected",
        reason: event.args.reason,
        txHash,
      };
    }
  }
  return { ok: false, status: "no_event", txHash };
}

/// Decode a single viem `Log` into a typed vault event, or return null if
/// the log is not from the PolicyVault. Useful for UI event feeds.
export function decodeVaultEvent(log: Log): VaultEvent | null {
  try {
    const decoded = decodeEventLog({
      abi: policyVaultAbi,
      data: log.data,
      topics: log.topics,
    });
    if (
      decoded.eventName === "PurchaseApproved" ||
      decoded.eventName === "PurchaseRejected"
    ) {
      return { eventName: decoded.eventName, args: decoded.args } as VaultEvent;
    }
    return null;
  } catch {
    return null;
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message.split("\n")[0] ?? err.message;
  return String(err);
}
