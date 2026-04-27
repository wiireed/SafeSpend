/// Viem-wrapped client factory for talking to a deployed PolicyVault.
/// The agent (and any server-side script) constructs one of these per
/// request to bind chain + RPC + signer into a single bundle.

import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, avalancheFuji } from "viem/chains";

export type VaultClients = {
  chain: Chain;
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: ReturnType<typeof privateKeyToAccount>;
};

export type CreateVaultClientOpts = {
  chainId: number;
  rpcUrl: string;
  privateKey: Hex;
  /// Optional read/write timeouts. Default 30s.
  timeoutMs?: number;
};

export function createVaultClient(opts: CreateVaultClientOpts): VaultClients {
  const chain = pickChain(opts.chainId);
  const transport = http(opts.rpcUrl, { timeout: opts.timeoutMs ?? 30_000 });
  const account = privateKeyToAccount(opts.privateKey);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  return { chain, publicClient, walletClient, account };
}

function pickChain(chainId: number): Chain {
  if (chainId === foundry.id) return foundry;
  if (chainId === avalancheFuji.id) return avalancheFuji;
  throw new Error(`Unsupported chainId=${chainId}`);
}

/// Listing hash format pinned in the spec:
///   keccak256(abi.encode(address merchant, uint256 amount, string listingId))
/// The agent and the frontend must compute it the same way.
export function computeListingHash(args: {
  merchant: Hex;
  amount: bigint;
  listingId: string;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "string" }],
      [args.merchant, args.amount, args.listingId],
    ),
  );
}
