/// usePolicy — read the current PolicyVault policy for a given user.
/// Wraps wagmi's useReadContract; auto-refetches via the host's react-query
/// settings (or pass `refetchInterval` to override).

import { useReadContract } from "wagmi";
import type { Hex } from "viem";
import { policyVaultAbi } from "@safespend/contracts/abi";

export type Policy = {
  maxPerTx: bigint;
  maxTotal: bigint;
  expiresAt: bigint;
  authorizedAgent: Hex;
  version: bigint;
  allowedMerchants: readonly Hex[];
};

export function usePolicy(options: {
  vaultAddress: Hex | undefined;
  user: Hex | undefined;
  refetchIntervalMs?: number;
}): {
  policy: Policy | null;
  isLoading: boolean;
  /// True iff the read returned successfully and the user has never set a
  /// policy (version === 0n).
  isUnset: boolean;
} {
  const { vaultAddress, user, refetchIntervalMs } = options;

  const { data, isLoading } = useReadContract({
    address: vaultAddress,
    abi: policyVaultAbi,
    functionName: "getPolicy",
    args: user ? [user] : undefined,
    query: {
      enabled: !!vaultAddress && !!user,
      refetchInterval: refetchIntervalMs,
    },
  });

  const policy = data
    ? ({
        maxPerTx: data.maxPerTx,
        maxTotal: data.maxTotal,
        expiresAt: data.expiresAt,
        authorizedAgent: data.authorizedAgent,
        version: BigInt(data.version),
        allowedMerchants: data.allowedMerchants,
      } as Policy)
    : null;

  return {
    policy,
    isLoading,
    isUnset: !!policy && policy.version === 0n,
  };
}
