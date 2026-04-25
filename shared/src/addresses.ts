import type { SupportedChainId } from "./explorer.js";

export type DeployedAddresses = {
  vault: `0x${string}`;
  usdc: `0x${string}`;
};

const ZERO: `0x${string}` = "0x0000000000000000000000000000000000000000";

export const ADDRESSES: Record<SupportedChainId, DeployedAddresses> = {
  31337: {
    vault: ZERO,
    usdc: ZERO,
  },
  43113: {
    vault: ZERO,
    usdc: ZERO,
  },
};

export function getAddresses(chainId: number): DeployedAddresses {
  const entry = ADDRESSES[chainId as SupportedChainId];
  if (!entry) throw new Error(`No deployed addresses for chainId=${chainId}`);
  return entry;
}
