"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import type { Hex } from "viem";
import { mockUsdcAbi, policyVaultAbi, ADDRESSES } from "@/lib/contracts";
import { parseUsdc, formatUsdc } from "@/lib/format";
import { PolicyDialog } from "./PolicyDialog";

const ONE_HUNDRED = parseUsdc("100");
const FIVE_HUNDRED = parseUsdc("500");

export function Onboarding() {
  const { address } = useAccount();
  const chainId = useChainId();
  const addrs = ADDRESSES[chainId as 31337 | 43113];
  const [policyOpen, setPolicyOpen] = useState(false);

  const { data: policy, refetch: refetchPolicy } = useReadContract({
    address: addrs?.vault,
    abi: policyVaultAbi,
    functionName: "getPolicy",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!addrs },
  });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: addrs?.usdc,
    abi: mockUsdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!addrs },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: addrs?.usdc,
    abi: mockUsdcAbi,
    functionName: "allowance",
    args: address && addrs ? [address, addrs.vault] : undefined,
    query: { enabled: !!address && !!addrs },
  });

  const { data: deposited, refetch: refetchDeposited } = useReadContract({
    address: addrs?.vault,
    abi: policyVaultAbi,
    functionName: "deposited",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!addrs },
  });

  const policyTuple = policy as { version: bigint } | undefined;
  const hasPolicy = policyTuple !== undefined && policyTuple.version > 0n;
  const userBalance = balance as bigint | undefined;
  const userAllowance = allowance as bigint | undefined;
  const userDeposited = deposited as bigint | undefined;

  const refresh = () => {
    refetchPolicy();
    refetchBalance();
    refetchAllowance();
    refetchDeposited();
  };

  if (!address || !addrs) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
        Connect a wallet to start.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Step
        active={!hasPolicy}
        done={hasPolicy}
        title="1. Set spending policy"
        description="Limits, expiry, the authorized agent, and the merchant allowlist."
        action={
          <button
            onClick={() => setPolicyOpen(true)}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500"
          >
            {hasPolicy
              ? `Policy set (v${policyTuple!.version.toString()}) · update`
              : "Set policy"}
          </button>
        }
      />

      <Step
        active={hasPolicy && (userBalance ?? 0n) < FIVE_HUNDRED}
        done={(userBalance ?? 0n) >= FIVE_HUNDRED}
        title="2. Mint MockUSDC (demo)"
        description={`You have ${formatUsdc(userBalance)} USDC.`}
        action={
          <MintButton
            usdc={addrs.usdc}
            user={address}
            disabled={!hasPolicy}
            onDone={refresh}
          />
        }
      />

      <Step
        active={
          hasPolicy &&
          (userBalance ?? 0n) >= FIVE_HUNDRED &&
          (userAllowance ?? 0n) < FIVE_HUNDRED
        }
        done={(userAllowance ?? 0n) >= FIVE_HUNDRED}
        title="3. Approve vault to pull USDC"
        description={`Allowance: ${formatUsdc(userAllowance)} USDC.`}
        action={
          <ApproveButton
            usdc={addrs.usdc}
            vault={addrs.vault}
            disabled={!hasPolicy || (userBalance ?? 0n) < FIVE_HUNDRED}
            onDone={refresh}
          />
        }
      />

      <Step
        active={
          hasPolicy &&
          (userAllowance ?? 0n) >= FIVE_HUNDRED &&
          (userDeposited ?? 0n) < FIVE_HUNDRED
        }
        done={(userDeposited ?? 0n) >= FIVE_HUNDRED}
        title="4. Deposit into vault"
        description={
          hasPolicy
            ? `Deposited: ${formatUsdc(userDeposited)} USDC.`
            : "Deposit is hidden until a policy exists."
        }
        action={
          hasPolicy ? (
            <DepositButton
              vault={addrs.vault}
              disabled={(userAllowance ?? 0n) < FIVE_HUNDRED}
              onDone={refresh}
            />
          ) : null
        }
      />

      {policyOpen && (
        <PolicyDialog
          onClose={() => {
            setPolicyOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Step({
  active,
  done,
  title,
  description,
  action,
}: {
  active: boolean;
  done: boolean;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 ${
        done
          ? "border-emerald-700/50 bg-emerald-950/30"
          : active
            ? "border-neutral-700 bg-neutral-900/50"
            : "border-neutral-800 bg-neutral-900/30 opacity-60"
      }`}
    >
      <div>
        <div className="flex items-center gap-2">
          <span
            className={`text-base ${
              done ? "text-emerald-400" : active ? "text-neutral-100" : "text-neutral-500"
            }`}
          >
            {done ? "✓" : "○"}
          </span>
          <span className="font-medium">{title}</span>
        </div>
        <div className="mt-0.5 ml-6 text-sm text-neutral-400">{description}</div>
      </div>
      {action}
    </div>
  );
}

function MintButton({
  usdc,
  user,
  disabled,
  onDone,
}: {
  usdc: Hex;
  user: Hex;
  disabled: boolean;
  onDone: () => void;
}) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) onDone();
  return (
    <button
      onClick={() =>
        writeContract({
          address: usdc,
          abi: mockUsdcAbi,
          functionName: "mint",
          args: [user, parseUsdc("1000")],
        })
      }
      disabled={disabled || isPending || isLoading}
      className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-50"
    >
      {isPending ? "Awaiting…" : isLoading ? "Confirming…" : "Mint 1000 USDC"}
    </button>
  );
}

function ApproveButton({
  usdc,
  vault,
  disabled,
  onDone,
}: {
  usdc: Hex;
  vault: Hex;
  disabled: boolean;
  onDone: () => void;
}) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) onDone();
  return (
    <button
      onClick={() =>
        writeContract({
          address: usdc,
          abi: mockUsdcAbi,
          functionName: "approve",
          args: [vault, parseUsdc("1000000")],
        })
      }
      disabled={disabled || isPending || isLoading}
      className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-50"
    >
      {isPending ? "Awaiting…" : isLoading ? "Confirming…" : "Approve"}
    </button>
  );
}

function DepositButton({
  vault,
  disabled,
  onDone,
}: {
  vault: Hex;
  disabled: boolean;
  onDone: () => void;
}) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });
  if (isSuccess) onDone();
  return (
    <button
      onClick={() =>
        writeContract({
          address: vault,
          abi: policyVaultAbi,
          functionName: "deposit",
          args: [ONE_HUNDRED * 5n],
        })
      }
      disabled={disabled || isPending || isLoading}
      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
    >
      {isPending ? "Awaiting…" : isLoading ? "Confirming…" : "Deposit 500 USDC"}
    </button>
  );
}
