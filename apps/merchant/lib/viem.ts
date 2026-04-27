/// Browser viem clients. Wired in PR 4.
import { createPublicClient, http } from "viem";
import { foundry, avalancheFuji } from "viem/chains";

export const SUPPORTED_CHAINS = [foundry, avalancheFuji] as const;

export function makePublicClient(chainId: number) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  if (!chain) throw new Error(`Unsupported chainId=${chainId}`);
  return createPublicClient({ chain, transport: http() });
}
