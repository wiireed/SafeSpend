/// Server-side ENS forward resolver. Mainnet only — addresses are global
/// across EVM chains, so a name resolved here is valid for use on Anvil
/// or Fuji. Used by the proposePurchase tool when listings reference an
/// ENS name instead of a raw 0x.
///
/// We deliberately spin up our own mainnet public client here rather than
/// reusing the agent's chain client, which is bound to whichever chain the
/// agent is broadcasting transactions on (Anvil or Fuji).

import { createPublicClient, getAddress, http, isAddress, type Hex } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

const DEFAULT_MAINNET_RPC = "https://eth.llamarpc.com";

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.MAINNET_RPC_URL ?? DEFAULT_MAINNET_RPC, {
    timeout: 5_000,
  }),
});

const cache = new Map<string, { address: Hex | null; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const RESOLVE_TIMEOUT_MS = 4_000;

export async function resolveEns(name: string): Promise<Hex | null> {
  const trimmed = name.trim();
  const cached = cache.get(trimmed);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.address;

  let normalized: string;
  try {
    normalized = normalize(trimmed);
  } catch {
    cache.set(trimmed, { address: null, ts: Date.now() });
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
    cache.set(trimmed, { address, ts: Date.now() });
    return address;
  } catch {
    cache.set(trimmed, { address: null, ts: Date.now() });
    return null;
  }
}

/// Accepts either a hex address or an ENS name. Returns checksummed 0x or null.
export async function resolveAddressOrEns(input: string): Promise<Hex | null> {
  const trimmed = input.trim();
  if (isAddress(trimmed)) return getAddress(trimmed);
  if (trimmed.includes(".") && !trimmed.startsWith("0x"))
    return resolveEns(trimmed);
  return null;
}
