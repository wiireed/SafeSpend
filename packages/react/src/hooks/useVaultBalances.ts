/// USDC balance reader for an arbitrary set of addresses. Returns a
/// Map keyed by lowercased address so callers can look up by string.
/// Auto-refetches on a configurable interval; default 3s.

import { useReadContracts } from "wagmi";
import { type Hex } from "viem";
import { mockUsdcAbi } from "@safespend/contracts/abi";

export type UseVaultBalancesOptions = {
  usdcAddress: Hex | undefined;
  addresses: Hex[];
  refetchIntervalMs?: number;
};

export function useVaultBalances(options: UseVaultBalancesOptions): {
  balances: Map<string, bigint>;
  isLoading: boolean;
} {
  const { usdcAddress, addresses, refetchIntervalMs = 3000 } = options;

  const { data, isLoading } = useReadContracts({
    contracts: addresses.map((addr) => ({
      address: usdcAddress,
      abi: mockUsdcAbi,
      functionName: "balanceOf",
      args: [addr],
    })),
    query: { enabled: !!usdcAddress, refetchInterval: refetchIntervalMs },
  });

  const balances = new Map<string, bigint>();
  if (data) {
    addresses.forEach((addr, i) => {
      const result = data[i]?.result;
      if (typeof result === "bigint") {
        balances.set(addr.toLowerCase(), result);
      }
    });
  }

  return { balances, isLoading };
}
