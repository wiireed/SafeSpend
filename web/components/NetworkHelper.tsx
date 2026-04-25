"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

type ChainSpec = {
  id: number;
  hex: string;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: 18 };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
};

const ANVIL: ChainSpec = {
  id: 31337,
  hex: "0x7a69",
  name: "Anvil (SafeSpend local)",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["http://127.0.0.1:8545"],
  blockExplorerUrls: [],
};

const FUJI: ChainSpec = {
  id: 43113,
  hex: "0xa869",
  name: "Avalanche Fuji",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
  blockExplorerUrls: ["https://testnet.snowtrace.io"],
};

/// The "expected" chain is whatever the deployed app is targeting,
/// configured via NEXT_PUBLIC_CHAIN_ID. Defaults to Anvil for local dev.
function getExpectedChain(): ChainSpec {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
  const id = raw ? parseInt(raw, 10) : 31337;
  if (id === 43113) return FUJI;
  return ANVIL;
}

export function NetworkHelper() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expected = getExpectedChain();

  if (!isConnected) return null;
  if (chainId === expected.id) return null;

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
        params: [{ chainId: expected.hex }],
      });
    } catch (switchErr) {
      const code = (switchErr as { code?: number })?.code;
      if (code === 4902 || code === -32603) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: expected.hex,
                chainName: expected.name,
                nativeCurrency: expected.nativeCurrency,
                rpcUrls: expected.rpcUrls,
                blockExplorerUrls: expected.blockExplorerUrls ?? [],
              },
            ],
          });
        } catch (addErr) {
          setError(
            (addErr as { message?: string })?.message ??
              `Failed to add ${expected.name}.`,
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

  const isAnvil = expected.id === 31337;
  const subtext = isAnvil
    ? "MetaMask may warn that chain ID 31337 looks like “GoChain Testnet” — that’s a cosmetic registry collision and safe to approve for local Anvil."
    : "Avalanche Fuji is a public testnet — you’ll need testnet AVAX from the Core faucet (https://core.app/tools/testnet-faucet) to interact.";

  return (
    <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-amber-200">
            Wallet is on chain {chainId} — switch to {expected.name} to use the demo.
          </div>
          <div className="mt-0.5 text-xs text-amber-300/80">{subtext}</div>
        </div>
        <button
          onClick={onClick}
          disabled={busy}
          className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-50"
        >
          {busy ? "Switching…" : `Add / switch to ${isAnvil ? "Anvil" : "Fuji"}`}
        </button>
      </div>
      {error && <div className="mt-2 text-xs text-rose-400">{error}</div>}
    </div>
  );
}
