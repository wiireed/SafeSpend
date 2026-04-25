export type SupportedChainId = 31337 | 43113;

const EXPLORERS: Record<number, string | null> = {
  31337: null,
  43113: "https://testnet.snowtrace.io",
};

export function explorerTxUrl(chainId: number, txHash: string): string | null {
  const base = EXPLORERS[chainId];
  if (!base) return null;
  return `${base}/tx/${txHash}`;
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  const base = EXPLORERS[chainId];
  if (!base) return null;
  return `${base}/address/${address}`;
}
