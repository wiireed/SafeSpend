"use client";

/// /activity — historical on-chain event feed for the PolicyVault.
///
/// Queries Fuji's getLogs for PurchaseApproved + PurchaseRejected
/// events, regardless of connected wallet. Auto-refreshes every 60s.
/// Each entry links out to Snowtrace.
///
/// Independent from the homepage's live <EventFeed />, which only
/// shows events fired in the current session via watchContractEvent.
/// This page is the persistent "all-time" view for judges + users
/// who want to inspect activity outside a session.

import { useEffect, useState } from "react";
import { avalancheFuji } from "viem/chains";
import { useVaultActivityHistory, type VaultActivityEntry } from "@safespend/react";
import { ADDRESSES, REASON_CODE_LABELS } from "@/lib/contracts";
import { MERCHANT_ENS } from "@/lib/merchants";
import { formatUsdc, shortAddress } from "@/lib/format";

const FUJI_VAULT = ADDRESSES[43113].vault;

/// Use the public Fuji RPC for historical getLogs queries — it allows
/// ~2000-block ranges by default, vs Alchemy free tier's strict 10-block
/// cap on eth_getLogs. The Alchemy URL is fine for high-frequency contract
/// reads (used elsewhere in the app), but for a one-shot historical query
/// on a public-facing page the public RPC is more permissive and removes
/// the API key dependency.
const PUBLIC_FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";

export default function ActivityPage() {
  const { entries, status, error, latestBlock } = useVaultActivityHistory({
    vaultAddress: FUJI_VAULT,
    chain: avalancheFuji,
    rpcUrl: PUBLIC_FUJI_RPC,
  });
  const [now, setNow] = useState<number>(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const tick = setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      30_000,
    );
    return () => clearInterval(tick);
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="font-semibold">SafeSpend</span>
            <span className="hidden text-sm text-neutral-500 sm:inline">
              activity
            </span>
            <span className="ml-1 shrink-0 rounded border border-rose-800/60 bg-rose-900/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-300 sm:ml-2">
              Avalanche Fuji
            </span>
          </div>
          <a
            href="/"
            className="shrink-0 text-sm text-neutral-400 hover:text-neutral-200"
          >
            ← back
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-800/50 bg-emerald-950/30 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            On-chain · auto-refreshes every 60s
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Live PolicyVault activity
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Every <code className="text-emerald-300">PurchaseApproved</code> and{" "}
            <code className="text-rose-300">PurchaseRejected</code> event
            emitted by the PolicyVault contract on Avalanche Fuji. Read
            directly from chain — no backend, no indexer.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span>
              Vault:{" "}
              <a
                href={`https://testnet.snowtrace.io/address/${FUJI_VAULT}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-neutral-400 hover:text-emerald-400"
              >
                {shortAddress(FUJI_VAULT)}
              </a>
            </span>
            {latestBlock !== null && (
              <span>
                Head: <span className="font-mono">{latestBlock.toString()}</span>
              </span>
            )}
            <span>
              {entries.length} event{entries.length === 1 ? "" : "s"} in window
            </span>
          </div>
        </section>

        {status === "loading" && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-sm text-neutral-500">
            Loading events from Fuji…
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg border border-rose-800/40 bg-rose-950/20 p-4 text-sm text-rose-300">
            Failed to load events: {error}
          </div>
        )}

        {status === "ready" && entries.length === 0 && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-6 text-center text-sm text-neutral-500">
            No events in the last 2,000 blocks (~67 min).
            <br />
            Try clicking <strong>Run</strong> on the{" "}
            <a href="/" className="text-emerald-400 hover:underline">
              homepage demo
            </a>{" "}
            to generate some.
          </div>
        )}

        {status === "ready" && entries.length > 0 && (
          <ul className="space-y-2">
            {entries.map((e) => (
              <ActivityRow key={`${e.txHash}-${e.kind}`} entry={e} now={now} />
            ))}
          </ul>
        )}
      </div>

      <footer className="mx-auto max-w-5xl px-4 pb-8 pt-4 text-center text-xs text-neutral-600 sm:px-6">
        SafeSpend · the agent can be tricked · the wallet cannot.
      </footer>
    </main>
  );
}

function ActivityRow({
  entry,
  now,
}: {
  entry: VaultActivityEntry;
  now: number;
}) {
  const accent =
    entry.kind === "approved"
      ? "border-emerald-700/40 bg-emerald-950/30"
      : "border-rose-700/40 bg-rose-950/30";
  const label = entry.kind === "approved" ? "✓ Approved" : "✗ Rejected";
  const labelColor =
    entry.kind === "approved" ? "text-emerald-400" : "text-rose-400";
  const merchantEns = MERCHANT_ENS[entry.merchant.toLowerCase()];
  const ago = relativeTime(entry.timestamp, now);

  return (
    <li
      className={`flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${accent}`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={labelColor}>{label}</span>
          <span className="font-mono text-neutral-100">
            {formatUsdc(entry.amount)} USDC
          </span>
          {entry.reason && (
            <span className="rounded bg-rose-950/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-rose-300">
              {REASON_CODE_LABELS[entry.reason] ?? entry.reason}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
          <span>
            →{" "}
            {merchantEns ? (
              <span className="font-mono text-emerald-400">{merchantEns}</span>
            ) : (
              <span className="font-mono">{shortAddress(entry.merchant)}</span>
            )}
          </span>
          <span>
            from <span className="font-mono">{shortAddress(entry.user)}</span>
          </span>
          {entry.policyVersion !== undefined && (
            <span>policy v{entry.policyVersion.toString()}</span>
          )}
          <span>{ago}</span>
        </div>
      </div>
      <a
        href={`https://testnet.snowtrace.io/tx/${entry.txHash}`}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 self-start rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300 transition hover:border-neutral-600 hover:text-neutral-100 sm:self-center"
      >
        View on Snowtrace ↗
      </a>
    </li>
  );
}

function relativeTime(then: number, now: number): string {
  if (then === 0) return "block …";
  const diff = now - then;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
