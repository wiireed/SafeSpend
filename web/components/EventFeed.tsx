"use client";

import { useEffect, useState } from "react";
import { useChainId, usePublicClient } from "wagmi";
import { decodeEventLog, type Log } from "viem";
import { policyVaultAbi, ADDRESSES, REASON_CODE_LABELS } from "@/lib/contracts";
import { formatUsdc, shortAddress } from "@/lib/format";

type FeedEntry = {
  txHash: string;
  kind: "approved" | "rejected";
  user: string;
  merchant: string;
  amount: bigint;
  reason?: string;
};

export function EventFeed() {
  const chainId = useChainId();
  const addrs = ADDRESSES[chainId as 31337 | 43113];
  const pub = usePublicClient();
  const [entries, setEntries] = useState<FeedEntry[]>([]);

  useEffect(() => {
    if (!pub || !addrs) return;
    const unwatchApproved = pub.watchContractEvent({
      address: addrs.vault,
      abi: policyVaultAbi,
      eventName: "PurchaseApproved",
      onLogs: (logs: Log[]) => {
        for (const log of logs) {
          try {
            const d = decodeEventLog({
              abi: policyVaultAbi,
              data: log.data,
              topics: log.topics,
            }) as unknown as { args: { user: string; merchant: string; amount: bigint } };
            const next: FeedEntry = {
              txHash: log.transactionHash ?? "",
              kind: "approved",
              user: d.args.user,
              merchant: d.args.merchant,
              amount: d.args.amount,
            };
            setEntries((prev) => [next, ...prev].slice(0, 20));
          } catch {
            /* ignore */
          }
        }
      },
    });
    const unwatchRejected = pub.watchContractEvent({
      address: addrs.vault,
      abi: policyVaultAbi,
      eventName: "PurchaseRejected",
      onLogs: (logs: Log[]) => {
        for (const log of logs) {
          try {
            const d = decodeEventLog({
              abi: policyVaultAbi,
              data: log.data,
              topics: log.topics,
            }) as unknown as {
              args: {
                user: string;
                merchant: string;
                amount: bigint;
                reason: string;
              };
            };
            const next: FeedEntry = {
              txHash: log.transactionHash ?? "",
              kind: "rejected",
              user: d.args.user,
              merchant: d.args.merchant,
              amount: d.args.amount,
              reason: d.args.reason,
            };
            setEntries((prev) => [next, ...prev].slice(0, 20));
          } catch {
            /* ignore */
          }
        }
      },
    });
    return () => {
      unwatchApproved();
      unwatchRejected();
    };
  }, [pub, addrs?.vault]);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-sm text-neutral-500">
        No on-chain events yet. Run the agent to populate the feed.
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {entries.map((e, i) => (
        <li
          key={`${e.txHash}-${i}`}
          className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
            e.kind === "approved"
              ? "border-emerald-700/40 bg-emerald-950/30"
              : "border-rose-700/40 bg-rose-950/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={
                e.kind === "approved" ? "text-emerald-400" : "text-rose-400"
              }
            >
              {e.kind === "approved" ? "✓ Approved" : "✗ Rejected"}
            </span>
            <span className="text-neutral-400">
              → {shortAddress(e.merchant)} · {formatUsdc(e.amount)} USDC
            </span>
          </div>
          {e.reason && (
            <span className="text-xs text-rose-300">
              {REASON_CODE_LABELS[e.reason] ?? e.reason}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
