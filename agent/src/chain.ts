/// viem client factory. Wired in PR 3.
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Chain, Hex } from "viem";

export type ChainClients = {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
};

export function makeChainClients(opts: {
  chain: Chain;
  rpcUrl: string;
  privateKey: Hex;
}): ChainClients {
  const transport = http(opts.rpcUrl);
  const account = privateKeyToAccount(opts.privateKey);
  return {
    publicClient: createPublicClient({ chain: opts.chain, transport }),
    walletClient: createWalletClient({ account, chain: opts.chain, transport }),
  };
}
