import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  keccak256,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry, avalancheFuji } from "viem/chains";

export type ChainClients = {
  chain: Chain;
  publicClient: PublicClient;
  walletClient: WalletClient;
  account: ReturnType<typeof privateKeyToAccount>;
};

export function makeChainClients(opts: {
  chainId: number;
  rpcUrl: string;
  privateKey: Hex;
}): ChainClients {
  const chain = pickChain(opts.chainId);
  const transport = http(opts.rpcUrl, { timeout: 30_000 });
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
export function listingHash(
  merchant: Hex,
  amount: bigint,
  listingId: string,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "string" }],
      [merchant, amount, listingId],
    ),
  );
}
