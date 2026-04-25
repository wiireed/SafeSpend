import type { SupportedChainId } from "./explorer.js";

export type DeployedAddresses = {
  vault: `0x${string}`;
  usdc: `0x${string}`;
};

const ZERO: `0x${string}` = "0x0000000000000000000000000000000000000000";

export const ADDRESSES: Record<SupportedChainId, DeployedAddresses> = {
  // Anvil default deployer account #0 with nonces 0 then 1.
  // Run `forge script Deploy --root contracts --rpc-url http://127.0.0.1:8545
  //        --private-key 0xac0974...ff80 --broadcast` to reproduce.
  31337: {
    usdc: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    vault: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  },
  // PR 5 fills these in after the Fuji deployment.
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
