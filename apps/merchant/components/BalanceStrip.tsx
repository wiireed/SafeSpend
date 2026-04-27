"use client";

import { useChainId, useReadContracts } from "wagmi";
import { mockUsdcAbi, ADDRESSES, ANVIL_ACCOUNTS } from "@/lib/contracts";
import { MERCHANT_ENS } from "@/lib/merchants";
import { formatUsdc, shortAddress } from "@/lib/format";

const ROLES = [
  { key: "user", label: "User", addr: ANVIL_ACCOUNTS.user },
  { key: "vault", label: "Vault", addr: null }, // filled at render
  { key: "agent", label: "Agent", addr: ANVIL_ACCOUNTS.agent },
  { key: "merchantA", label: "Merchant A ✓", addr: ANVIL_ACCOUNTS.merchantA },
  { key: "merchantB", label: "Merchant B ✓", addr: ANVIL_ACCOUNTS.merchantB },
  { key: "merchantC", label: "Merchant C ✗", addr: ANVIL_ACCOUNTS.merchantC },
] as const;

export function BalanceStrip() {
  const chainId = useChainId();
  const addrs = ADDRESSES[chainId as 31337 | 43113];

  const targets = ROLES.map((r) => (r.key === "vault" ? addrs?.vault : r.addr)).filter(
    Boolean,
  ) as `0x${string}`[];

  const { data } = useReadContracts({
    contracts: targets.map((t) => ({
      address: addrs?.usdc,
      abi: mockUsdcAbi,
      functionName: "balanceOf",
      args: [t],
    })),
    query: { enabled: !!addrs, refetchInterval: 3000 },
  });

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {ROLES.map((role, i) => {
        const addr = role.key === "vault" ? addrs?.vault : role.addr;
        const balance = data?.[i]?.result as bigint | undefined;
        const ens = addr ? MERCHANT_ENS[addr.toLowerCase()] : undefined;
        return (
          <div
            key={role.key}
            className="min-w-0 rounded-md border border-neutral-800 bg-neutral-900/50 p-2"
          >
            <div className="text-[10px] uppercase tracking-wide text-neutral-500">
              {role.label}
            </div>
            {ens && (
              <div
                className="mt-0.5 truncate font-mono text-[10px] text-emerald-400 sm:text-xs"
                title={ens}
              >
                {ens}
              </div>
            )}
            <div
              className={`${ens ? "mt-0" : "mt-0.5"} font-mono text-[10px] text-neutral-500`}
            >
              {addr ? shortAddress(addr) : "—"}
            </div>
            <div className="mt-1 font-mono text-sm">
              {formatUsdc(balance)} <span className="text-neutral-500">USDC</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
