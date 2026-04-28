/// usePolicySetter — wagmi useWriteContract + useWaitForTransactionReceipt
/// glued together for PolicyVault.setPolicy. Form-state for the policy
/// inputs is the host app's concern (see apps/merchant/components/PolicyDialog
/// for the reference implementation including ENS-resolution staging).

import { useCallback } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import type { Hex } from "viem";
import { policyVaultAbi } from "@safespend/contracts/abi";

export type PolicyInput = {
  maxPerTx: bigint;
  maxTotal: bigint;
  expiresAt: bigint;
  authorizedAgent: Hex;
  allowedMerchants: Hex[];
};

export type UsePolicySetterResult = {
  setPolicy: (input: PolicyInput) => void;
  txHash: Hex | undefined;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: Error | null;
  reset: () => void;
};

export function usePolicySetter(options: {
  vaultAddress: Hex | undefined;
}): UsePolicySetterResult {
  const { vaultAddress } = options;

  const {
    writeContract,
    data: txHash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const setPolicy = useCallback(
    (input: PolicyInput) => {
      if (!vaultAddress) return;
      writeContract({
        address: vaultAddress,
        abi: policyVaultAbi,
        functionName: "setPolicy",
        args: [input],
      });
    },
    [vaultAddress, writeContract],
  );

  return {
    setPolicy,
    txHash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
