"use client";

import { useChainId } from "wagmi";
import { useVaultEvents } from "@safespend/react";
import { ADDRESSES, REASON_CODE_LABELS } from "@/lib/contracts";
import { formatUsdc, shortAddress } from "@/lib/format";

export function EventFeed() {
  const chainId = useChainId();
  const addrs = ADDRESSES[chainId as 31337 | 43113];
  const entries = useVaultEvents({ vaultAddress: addrs?.vault });

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
              ? "border-emerald-700/40 bg-emerald-950/30 flash-in-emerald"
              : "border-rose-700/40 bg-rose-950/30 flash-in-rose"
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
          {e.kind === "rejected" && e.reason && (
            <span className="text-xs text-rose-300">
              {REASON_CODE_LABELS[e.reason] ?? e.reason}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
