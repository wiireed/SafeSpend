/// Deployed PolicyVault + MockUSDC addresses, keyed by chain id.
///
/// Updated automatically by scripts/update-fuji-addresses.mjs after a
/// `pnpm fuji:deploy`. The chain set here must stay in sync with
/// `SupportedChainId` in @safespend/sdk's explorer module.

export type SupportedChainId = 31337 | 43113;

export type DeployedAddresses = {
  vault: `0x${string}`;
  usdc: `0x${string}`;
};

export const ADDRESSES: Record<SupportedChainId, DeployedAddresses> = {
  // Anvil default deployer account #0 with nonces 0 then 1.
  // Run `forge script Deploy --root packages/contracts --rpc-url http://127.0.0.1:8545
  //        --private-key 0xac0974...ff80 --broadcast` to reproduce.
  31337: {
    usdc: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    vault: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  },
  43113: {
    usdc: "0x6754c656fe1ca74c9941f3d9aeac2d7fd93868e8",
    vault: "0x15b2b50fcc06ccde9e80f4393b828f709f4934ba",
  },
};

export function getAddresses(chainId: number): DeployedAddresses {
  const entry = ADDRESSES[chainId as SupportedChainId];
  if (!entry) throw new Error(`No deployed addresses for chainId=${chainId}`);
  return entry;
}
