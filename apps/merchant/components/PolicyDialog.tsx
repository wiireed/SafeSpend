"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { isAddress, type Hex } from "viem";
import { usePolicySetter } from "@safespend/react";
import { ADDRESSES, ANVIL_ACCOUNTS } from "@/lib/contracts";
import { parseUsdc } from "@/lib/format";
import { resolveAddressOrEns } from "@/lib/ens";

type ResolvedRow =
  | { kind: "address"; input: string; address: Hex }
  | { kind: "ens-pending"; input: string }
  | { kind: "ens-resolved"; input: string; address: Hex }
  | { kind: "ens-failed"; input: string }
  | { kind: "invalid"; input: string };

export function PolicyDialog({ onClose }: { onClose: () => void }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const addrs = ADDRESSES[chainId as 31337 | 43113];

  const [maxPerTx, setMaxPerTx] = useState("100");
  const [maxTotal, setMaxTotal] = useState("500");
  const [hours, setHours] = useState("24");
  const [authorizedAgent, setAuthorizedAgent] = useState<string>(ANVIL_ACCOUNTS.agent);
  const [merchants, setMerchants] = useState<string>(
    `${ANVIL_ACCOUNTS.merchantA}\n${ANVIL_ACCOUNTS.merchantB}`,
  );
  const [resolved, setResolved] = useState<ResolvedRow[]>([]);

  const { setPolicy, isPending, isConfirming, isSuccess, error } =
    usePolicySetter({ vaultAddress: addrs?.vault });

  useEffect(() => {
    const inputs = merchants
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (inputs.length === 0) {
      setResolved([]);
      return;
    }

    const initial: ResolvedRow[] = inputs.map((input) =>
      isAddress(input)
        ? { kind: "address", input, address: input as Hex }
        : input.includes(".")
          ? { kind: "ens-pending", input }
          : { kind: "invalid", input },
    );
    setResolved(initial);

    let cancelled = false;
    Promise.all(
      initial.map(async (row): Promise<ResolvedRow> => {
        if (row.kind !== "ens-pending") return row;
        const address = await resolveAddressOrEns(row.input);
        return address
          ? { kind: "ens-resolved", input: row.input, address }
          : { kind: "ens-failed", input: row.input };
      }),
    ).then((next) => {
      if (!cancelled) setResolved(next);
    });
    return () => {
      cancelled = true;
    };
  }, [merchants]);

  const allMerchantsOk =
    resolved.length > 0 &&
    resolved.every((r) => r.kind === "address" || r.kind === "ens-resolved");

  const submit = () => {
    if (!address || !addrs || !allMerchantsOk) return;
    const expiresAt = BigInt(
      Math.floor(Date.now() / 1000) + parseInt(hours, 10) * 3600,
    );
    const allowedMerchants = resolved
      .map((r) =>
        r.kind === "address" || r.kind === "ens-resolved" ? r.address : null,
      )
      .filter((a): a is Hex => a !== null);

    setPolicy({
      maxPerTx: parseUsdc(maxPerTx),
      maxTotal: parseUsdc(maxTotal),
      expiresAt,
      authorizedAgent: authorizedAgent as Hex,
      allowedMerchants,
    });
  };

  if (isSuccess) {
    setTimeout(onClose, 1000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Set spending policy</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Limits, expiry, the agent address authorized to act, and the
          allowlist of merchants the wallet may pay.
        </p>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max per tx (USDC)">
              <input
                type="text"
                value={maxPerTx}
                onChange={(e) => setMaxPerTx(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Max total (USDC)">
              <input
                type="text"
                value={maxTotal}
                onChange={(e) => setMaxTotal(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Expires in (hours)">
            <input
              type="text"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Authorized agent address">
            <input
              type="text"
              value={authorizedAgent}
              onChange={(e) => setAuthorizedAgent(e.target.value)}
              className={`${inputClass} font-mono text-xs`}
            />
          </Field>

          <Field label="Allowed merchants (one per line — 0x address or name.eth)">
            <textarea
              value={merchants}
              onChange={(e) => setMerchants(e.target.value)}
              rows={3}
              className={`${inputClass} font-mono text-xs`}
            />
            {resolved.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px]">
                {resolved.map((row, i) => (
                  <li key={`${row.input}-${i}`} className="font-mono">
                    {row.kind === "address" && (
                      <span className="text-neutral-400">
                        {short(row.address)}
                      </span>
                    )}
                    {row.kind === "ens-pending" && (
                      <span className="text-neutral-500">
                        {row.input} <span className="text-neutral-600">→ resolving…</span>
                      </span>
                    )}
                    {row.kind === "ens-resolved" && (
                      <span className="text-emerald-400">
                        {row.input}{" "}
                        <span className="text-neutral-500">→ {short(row.address)}</span>
                      </span>
                    )}
                    {row.kind === "ens-failed" && (
                      <span className="text-rose-400">
                        {row.input} <span className="text-neutral-500">→ no resolver</span>
                      </span>
                    )}
                    {row.kind === "invalid" && (
                      <span className="text-rose-400">
                        {row.input} <span className="text-neutral-500">→ not an address or .eth name</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Field>
        </div>

        {error && (
          <p className="mt-3 text-sm text-rose-400">
            {error.message.split("\n")[0]}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isPending || isConfirming || !address || !allMerchantsOk}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {isPending
              ? "Awaiting wallet…"
              : isConfirming
                ? "Confirming…"
                : isSuccess
                  ? "Saved!"
                  : "Set policy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:border-emerald-600";

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
