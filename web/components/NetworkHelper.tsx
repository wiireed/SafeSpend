"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";

const ANVIL_CHAIN_ID_HEX = "0x7a69"; // 31337

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

export function NetworkHelper() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConnected) return null;
  if (chainId === 31337 || chainId === 43113) return null;

  const onClick = async () => {
    const eth = getEthereum();
    if (!eth) {
      setError("No injected wallet detected.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ANVIL_CHAIN_ID_HEX }],
      });
    } catch (switchErr) {
      const code = (switchErr as { code?: number })?.code;
      if (code === 4902 || code === -32603) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: ANVIL_CHAIN_ID_HEX,
                chainName: "Anvil (SafeSpend local)",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["http://127.0.0.1:8545"],
                blockExplorerUrls: [],
              },
            ],
          });
        } catch (addErr) {
          setError(
            (addErr as { message?: string })?.message ??
              "Failed to add Anvil network.",
          );
        }
      } else {
        setError(
          (switchErr as { message?: string })?.message ??
            "Failed to switch network.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-amber-200">
            Wallet is on chain {chainId} — switch to Anvil to use the demo.
          </div>
          <div className="mt-0.5 text-xs text-amber-300/80">
            This adds the network programmatically. MetaMask may still warn that
            chain ID 31337 looks like &ldquo;GoChain Testnet&rdquo; — that&rsquo;s a
            cosmetic registry collision and safe to approve for local Anvil.
          </div>
        </div>
        <button
          onClick={onClick}
          disabled={busy}
          className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-50"
        >
          {busy ? "Switching…" : "Add / switch to Anvil"}
        </button>
      </div>
      {error && (
        <div className="mt-2 text-xs text-rose-400">{error}</div>
      )}
    </div>
  );
}
