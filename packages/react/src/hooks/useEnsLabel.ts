/// React-only ENS display hook. The pure async helpers (resolveEns,
/// reverseEns, resolveAddressOrEns) live in @safespend/sdk and can be
/// imported there for non-React contexts.

import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { reverseEns } from "@safespend/sdk/ens";

/// Returns the ENS name for an address if either:
///   1. it appears in the optional `overrides` map (preferred — populated
///      from a static catalog so we don't pay a mainnet round-trip per row), or
///   2. mainnet reverse-resolution returns a name within the timeout.
/// Falls back to null; callers render the original label/address.
export function useEnsLabel(
  address: Hex | undefined,
  options: {
    overrides?: Record<string, string>;
    rpcUrl?: string;
  } = {},
): string | null {
  const { overrides, rpcUrl } = options;
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
    reverseEns(address, { rpcUrl }).then((name) => {
      if (!cancelled) setLabel(name);
    });
    return () => {
      cancelled = true;
    };
  }, [address, overrides, rpcUrl]);

  return label;
}
