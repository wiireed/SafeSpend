/// ENS forward resolution. Mainnet only — addresses are global across EVM
/// chains, so a name resolved here is valid for use on Anvil or Fuji.
///
/// Two surfaces:
///   - resolveEns(name) — async, used at form-submit time (PolicyDialog).
///   - useEnsLabel(addr) — React hook with in-memory cache, used for display
///     (BalanceStrip).
///
/// The mainnet client is intentionally separate from wagmi's connected-wallet
/// chains. Adding mainnet to wagmi/chains would prompt MetaMask to switch
/// networks, which would break the demo.

import { useEffect, useState } from "react";
import { createPublicClient, http, isAddress, getAddress, type Hex } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const DEFAULT_MAINNET_RPC = "https://eth.llamarpc.com";

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? DEFAULT_MAINNET_RPC,
  ),
});

const forwardCache = new Map<string, { address: Hex | null; ts: number }>();
const reverseCache = new Map<string, { name: string | null; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const RESOLVE_TIMEOUT_MS = 4000;

function looksLikeEns(input: string): boolean {
  return input.includes(".") && !input.startsWith("0x");
}

/// Forward: ENS name → checksummed 0x address. Returns null on failure.
export async function resolveEns(name: string): Promise<Hex | null> {
  const trimmed = name.trim();
  const cached = forwardCache.get(trimmed);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.address;

  let normalized: string;
  try {
    normalized = normalize(trimmed);
  } catch {
    forwardCache.set(trimmed, { address: null, ts: Date.now() });
    return null;
  }

  try {
    const result = await Promise.race([
      mainnetClient.getEnsAddress({ name: normalized }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), RESOLVE_TIMEOUT_MS),
      ),
    ]);
    const address = result ? getAddress(result) : null;
    forwardCache.set(trimmed, { address, ts: Date.now() });
    return address;
  } catch {
    forwardCache.set(trimmed, { address: null, ts: Date.now() });
    return null;
  }
}

/// Accepts either a hex address or an ENS name. Returns checksummed 0x or null.
export async function resolveAddressOrEns(input: string): Promise<Hex | null> {
  const trimmed = input.trim();
  if (isAddress(trimmed)) return getAddress(trimmed);
  if (looksLikeEns(trimmed)) return resolveEns(trimmed);
  return null;
}

async function reverseLookup(addr: Hex): Promise<string | null> {
  const key = addr.toLowerCase();
  const cached = reverseCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.name;

  try {
    const name = await Promise.race([
      mainnetClient.getEnsName({ address: addr }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), RESOLVE_TIMEOUT_MS),
      ),
    ]);
    reverseCache.set(key, { name: name ?? null, ts: Date.now() });
    return name ?? null;
  } catch {
    reverseCache.set(key, { name: null, ts: Date.now() });
    return null;
  }
}

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
    reverseLookup(address).then((name) => {
      if (!cancelled) setLabel(name);
    });
    return () => {
      cancelled = true;
    };
  }, [address, overrides]);

  return label;
}
