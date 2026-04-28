/// useVaultActivityHistory — historical PurchaseApproved + PurchaseRejected
/// events from a deployed PolicyVault. Independent of the connected wallet's
/// chain (so e.g. the merchant's /activity page can show Fuji history even
/// when the wallet is on Anvil).
///
/// Caller provides a viem chain + RPC URL; the hook builds its own public
/// client. Auto-refreshes on a configurable interval.

import { useEffect, useState } from "react";
import {
  createPublicClient,
  http,
  type Chain,
  type Hex,
} from "viem";
import { policyVaultAbi } from "@safespend/contracts/abi";

export type VaultActivityEntry = {
  txHash: Hex;
  blockNumber: bigint;
  timestamp: number;
  kind: "approved" | "rejected";
  user: Hex;
  merchant: Hex;
  amount: bigint;
  listingHash: Hex;
  policyVersion?: bigint;
  reasonCode?: Hex;
  reason?: string;
};

export type UseVaultActivityHistoryOptions = {
  vaultAddress: Hex;
  chain: Chain;
  rpcUrl: string;
  /// Number of blocks of history to fetch. Default 2000. Public RPCs
  /// typically cap getLogs ranges at ~2000 blocks.
  historyBlocks?: bigint;
  /// Auto-refresh interval. Default 60 s. Set to 0 to disable.
  refetchIntervalMs?: number;
};

export function useVaultActivityHistory(
  options: UseVaultActivityHistoryOptions,
): {
  entries: VaultActivityEntry[];
  status: "loading" | "ready" | "error";
  error: string | null;
  latestBlock: bigint | null;
  refetch: () => void;
} {
  const {
    vaultAddress,
    chain,
    rpcUrl,
    historyBlocks = 2000n,
    refetchIntervalMs = 60_000,
  } = options;

  const [entries, setEntries] = useState<VaultActivityEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [latestBlock, setLatestBlock] = useState<bigint | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const client = createPublicClient({ chain, transport: http(rpcUrl) });

    const fetchEvents = async () => {
      try {
        const head = await client.getBlockNumber();
        if (cancelled) return;
        setLatestBlock(head);

        const fromBlock = head > historyBlocks ? head - historyBlocks : 0n;

        // Use getContractEvents so the ABI is the source of truth for
        // event signatures — hand-typing parseAbiItem strings is brittle.
        const [approvedLogs, rejectedLogs] = await Promise.all([
          client.getContractEvents({
            address: vaultAddress,
            abi: policyVaultAbi,
            eventName: "PurchaseApproved",
            fromBlock,
            toBlock: head,
          }),
          client.getContractEvents({
            address: vaultAddress,
            abi: policyVaultAbi,
            eventName: "PurchaseRejected",
            fromBlock,
            toBlock: head,
          }),
        ]);

        const allLogs = [
          ...approvedLogs.map((l) => ({ ...l, kind: "approved" as const })),
          ...rejectedLogs.map((l) => ({ ...l, kind: "rejected" as const })),
        ];

        const uniqueBlocks = Array.from(
          new Set(allLogs.map((l) => l.blockNumber)),
        ).filter((b): b is bigint => b !== null);

        const blockTimestamps = new Map<bigint, number>();
        await Promise.all(
          uniqueBlocks.map(async (bn) => {
            const block = await client.getBlock({ blockNumber: bn });
            blockTimestamps.set(bn, Number(block.timestamp));
          }),
        );

        if (cancelled) return;

        const next: VaultActivityEntry[] = allLogs
          .filter((l) => l.blockNumber !== null && l.transactionHash !== null)
          .map((l) => {
            const args = l.args as Record<string, unknown>;
            return {
              txHash: l.transactionHash as Hex,
              blockNumber: l.blockNumber as bigint,
              timestamp: blockTimestamps.get(l.blockNumber as bigint) ?? 0,
              kind: l.kind,
              user: args.user as Hex,
              merchant: args.merchant as Hex,
              amount: args.amount as bigint,
              listingHash: args.listingHash as Hex,
              policyVersion:
                l.kind === "approved"
                  ? (args.policyVersion as bigint)
                  : undefined,
              reasonCode:
                l.kind === "rejected" ? (args.reasonCode as Hex) : undefined,
              reason: l.kind === "rejected" ? (args.reason as string) : undefined,
            };
          })
          .sort((a, b) => Number(b.blockNumber - a.blockNumber));

        setEntries(next);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStatus("error");
      }
    };

    fetchEvents();
    const interval =
      refetchIntervalMs > 0
        ? setInterval(fetchEvents, refetchIntervalMs)
        : undefined;
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [vaultAddress, chain, rpcUrl, historyBlocks, refetchIntervalMs, refetchTick]);

  const refetch = () => setRefetchTick((n) => n + 1);

  return { entries, status, error, latestBlock, refetch };
}
