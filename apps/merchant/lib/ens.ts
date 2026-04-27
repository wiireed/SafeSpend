/// ENS helpers for the merchant app. The pure async helpers live in
/// @safespend/sdk; the React hook stays here (will move to @safespend/react
/// in PR 6).

import { useEffect, useState } from "react";
import { type Hex } from "viem";
import { reverseEns } from "@safespend/sdk/ens";

export {
  resolveEns,
  resolveAddressOrEns,
  reverseEns,
} from "@safespend/sdk/ens";

const MAINNET_RPC_URL = process.env.NEXT_PUBLIC_MAINNET_RPC_URL;

/// Display hook — returns the ENS name for an address if either:
///   1. it appears in the optional `overrides` map (preferred — populated
///      from listings.json so we don't pay a mainnet round-trip per row), or
///   2. mainnet reverse-resolution returns a name within the timeout.
/// Falls back to null; callers render the original label/address.
export function useEnsLabel(
  address: Hex | undefined,
  overrides?: Record<string, string>,
): string | null {
  const [label, setLabel] = useState<string | null>(() => {
    if (!address) return null;
    return overrides?.[address.toLowerCase()] ?? null;
  });

  useEffect(() => {
    if (!address) {
      setLabel(null);
      return;
    }
    const override = overrides?.[address.toLowerCase()];
    if (override) {
      setLabel(override);
      return;
    }
    let cancelled = false;
    reverseEns(address, { rpcUrl: MAINNET_RPC_URL }).then((name) => {
      if (!cancelled) setLabel(name);
    });
    return () => {
      cancelled = true;
    };
  }, [address, overrides]);

  return label;
}
