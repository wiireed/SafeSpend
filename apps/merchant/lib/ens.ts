/// ENS helpers for the merchant app — pure helpers from @safespend/sdk,
/// React hook from @safespend/react. This shim file exists so existing
/// `@/lib/ens` imports keep working without churning every component.

export {
  resolveEns,
  resolveAddressOrEns,
  reverseEns,
} from "@safespend/sdk/ens";

import { useEnsLabel as useEnsLabelInner } from "@safespend/react";
import type { Hex } from "viem";

const MAINNET_RPC_URL = process.env.NEXT_PUBLIC_MAINNET_RPC_URL;

/// Thin wrapper over @safespend/react's useEnsLabel that pre-injects the
/// app's NEXT_PUBLIC_MAINNET_RPC_URL so callers don't have to.
export function useEnsLabel(
  address: Hex | undefined,
  overrides?: Record<string, string>,
): string | null {
  return useEnsLabelInner(address, { overrides, rpcUrl: MAINNET_RPC_URL });
}
