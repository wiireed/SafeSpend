"use client";

import { useAccount, useChainId, useReadContract } from "wagmi";
import { ConnectButton } from "./ConnectButton";
import { policyVaultAbi, ADDRESSES } from "@/lib/contracts";
import { formatUsdc } from "@/lib/format";

export function TopBar() {
  const { address } = useAccount();
  const chainId = useChainId();
  const addrs = ADDRESSES[chainId as 31337 | 43113];

  const { data: policy } = useReadContract({
    address: addrs?.vault,
    abi: policyVaultAbi,
    functionName: "getPolicy",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!addrs },
  });

  const { data: remaining } = useReadContract({
    address: addrs?.vault,
    abi: policyVaultAbi,
    functionName: "remainingAllowance",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!addrs },
  });

  const policyTuple = policy as { version: bigint } | undefined;
  const remainingTuple = remaining as readonly [bigint, bigint] | undefined;

  const chainLabel = chainLabelFor(chainId);

  return (
    <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-semibold">SafeSpend</span>
          <span className="text-sm text-neutral-500">
            programmable wallet safety for AI agents
          </span>
          {chainLabel && (
            <span
              className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${chainLabel.className}`}
            >
              {chainLabel.text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-6 text-sm">
          {address && policyTuple ? (
            <div className="flex items-center gap-4">
              <span className="text-neutral-400">
                policy v{policyTuple.version.toString()}
              </span>
              {remainingTuple && (
                <span className="text-neutral-400">
                  remaining: {formatUsdc(remainingTuple[1])} /{" "}
                  {formatUsdc(remainingTuple[0])} per-tx
                </span>
              )}
            </div>
          ) : null}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

function chainLabelFor(
  chainId: number,
): { text: string; className: string } | null {
  if (chainId === 43113)
    return {
      text: "Avalanche Fuji",
      className: "bg-rose-900/40 text-rose-300 border border-rose-800/60",
    };
  if (chainId === 31337)
    return {
      text: "Local Anvil",
      className: "bg-neutral-800 text-neutral-400 border border-neutral-700",
    };
  return null;
}
