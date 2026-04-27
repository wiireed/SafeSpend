/// Mainnet ENS helpers — forward + reverse resolution, with TTL caches and
/// timeouts. Mainnet only because addresses are global across EVM chains;
/// a name resolved here is valid for use on Anvil or Fuji.
///
/// All callers may pass an explicit `rpcUrl`. Default: a public RPC. Each
/// host (CLI agent, Next.js server, browser hook) controls its own env
/// (MAINNET_RPC_URL vs NEXT_PUBLIC_MAINNET_RPC_URL); this module stays
/// transport-agnostic so it doesn't hardcode either.

import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  type Hex,
  type PublicClient,
} from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

export type EnsResolverOptions = {
  rpcUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
};

const DEFAULT_RPC = "https://eth.llamarpc.com";
const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

const clientCache = new Map<string, PublicClient>();
function getClient(rpcUrl: string): PublicClient {
  const existing = clientCache.get(rpcUrl);
  if (existing) return existing;
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { timeout: 5_000 }),
  });
  clientCache.set(rpcUrl, client);
  return client;
}

const forwardCache = new Map<string, { address: Hex | null; ts: number }>();
const reverseCache = new Map<string, { name: string | null; ts: number }>();

/// Forward: ENS name → checksummed 0x address. Returns null on failure.
export async function resolveEns(
  name: string,
  opts: EnsResolverOptions = {},
): Promise<Hex | null> {
  const ttl = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rpcUrl = opts.rpcUrl ?? DEFAULT_RPC;

  const trimmed = name.trim();
  const cached = forwardCache.get(trimmed);
  if (cached && Date.now() - cached.ts < ttl) return cached.address;

  let normalized: string;
  try {
    normalized = normalize(trimmed);
  } catch {
    forwardCache.set(trimmed, { address: null, ts: Date.now() });
    return null;
  }

  const client = getClient(rpcUrl);
  try {
    const result = await Promise.race([
      client.getEnsAddress({ name: normalized }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeout)),
    ]);
    const address = result ? getAddress(result) : null;
    forwardCache.set(trimmed, { address, ts: Date.now() });
    return address;
  } catch {
    forwardCache.set(trimmed, { address: null, ts: Date.now() });
    return null;
  }
}

/// Reverse: 0x address → primary ENS name (or null). Used for display.
export async function reverseEns(
  address: Hex,
  opts: EnsResolverOptions = {},
): Promise<string | null> {
  const ttl = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rpcUrl = opts.rpcUrl ?? DEFAULT_RPC;

  const key = address.toLowerCase();
  const cached = reverseCache.get(key);
  if (cached && Date.now() - cached.ts < ttl) return cached.name;

  const client = getClient(rpcUrl);
  try {
    const name = await Promise.race([
      client.getEnsName({ address }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeout)),
    ]);
    reverseCache.set(key, { name: name ?? null, ts: Date.now() });
    return name ?? null;
  } catch {
    reverseCache.set(key, { name: null, ts: Date.now() });
    return null;
  }
}

/// Accepts either a hex address or an ENS name. Returns checksummed 0x or null.
export async function resolveAddressOrEns(
  input: string,
  opts?: EnsResolverOptions,
): Promise<Hex | null> {
  const trimmed = input.trim();
  if (isAddress(trimmed)) return getAddress(trimmed);
  if (trimmed.includes(".") && !trimmed.startsWith("0x"))
    return resolveEns(trimmed, opts);
  return null;
}
