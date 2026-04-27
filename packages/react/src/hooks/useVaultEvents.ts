/// Live PolicyVault event feed. Subscribes to PurchaseApproved +
/// PurchaseRejected via wagmi's public client and returns a rolling
/// list of decoded entries (newest first).
///
/// The vault address is provided explicitly. Pair with @safespend/contracts'
/// ADDRESSES + wagmi's useChainId in the host app.

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { type Hex, type Log } from "viem";
import { policyVaultAbi } from "@safespend/contracts/abi";
import { decodeVaultEvent } from "@safespend/sdk/spend";

export type VaultFeedEntry =
  | {
      kind: "approved";
      txHash: Hex;
      user: Hex;
      merchant: Hex;
      amount: bigint;
      listingHash: Hex;
      policyVersion: bigint;
    }
  | {
      kind: "rejected";
      txHash: Hex;
      user: Hex;
      merchant: Hex;
      amount: bigint;
      listingHash: Hex;
      reasonCode: Hex;
      reason: string;
    };

export type UseVaultEventsOptions = {
  vaultAddress: Hex | undefined;
  /// Newest-first cap. Default 20.
  limit?: number;
};

export function useVaultEvents(
  options: UseVaultEventsOptions,
): VaultFeedEntry[] {
  const { vaultAddress, limit = 20 } = options;
  const pub = usePublicClient();
  const [entries, setEntries] = useState<VaultFeedEntry[]>([]);

  useEffect(() => {
    if (!pub || !vaultAddress) return;

    const append = (entry: VaultFeedEntry) =>
      setEntries((prev) => [entry, ...prev].slice(0, limit));

    const handle = (logs: Log[]) => {
      for (const log of logs) {
        const event = decodeVaultEvent(log);
        if (!event) continue;
        const txHash = (log.transactionHash ?? "0x") as Hex;
        if (event.eventName === "PurchaseApproved") {
          append({ kind: "approved", txHash, ...event.args });
        } else {
          append({ kind: "rejected", txHash, ...event.args });
        }
      }
    };

    const unwatchApproved = pub.watchContractEvent({
      address: vaultAddress,
      abi: policyVaultAbi,
      eventName: "PurchaseApproved",
      onLogs: handle,
    });
    const unwatchRejected = pub.watchContractEvent({
      address: vaultAddress,
      abi: policyVaultAbi,
      eventName: "PurchaseRejected",
      onLogs: handle,
    });

    return () => {
      unwatchApproved();
      unwatchRejected();
    };
  }, [pub, vaultAddress, limit]);

  return entries;
}
