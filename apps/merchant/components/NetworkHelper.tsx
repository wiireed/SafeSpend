"use client";

import { useNetworkSwitcher, type ChainSpec } from "@safespend/react";

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

function getExpectedChain(): ChainSpec {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
  const id = raw ? parseInt(raw, 10) : 31337;
  if (id === 43113) return FUJI;
  return ANVIL;
}

export function NetworkHelper() {
  const expected = getExpectedChain();
  const { needsSwitch, isPending, error, switchToExpected, currentChainId } =
    useNetworkSwitcher({ expectedChain: expected });

  if (!needsSwitch) return null;

  const isAnvil = expected.id === 31337;
  const subtext = isAnvil
    ? "MetaMask may warn that chain ID 31337 looks like “GoChain Testnet” — that’s a cosmetic registry collision and safe to approve for local Anvil."
    : "Avalanche Fuji is a public testnet — you’ll need testnet AVAX from the Core faucet to interact.";
  const buttonLabel = isAnvil ? "Switch to Anvil" : "Switch to Fuji";

  return (
    <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-medium text-amber-200">
            Wallet is on chain {currentChainId} — switch to {expected.name} to use the demo.
          </div>
          <div className="mt-0.5 text-xs text-amber-300/80">{subtext}</div>
        </div>
        <button
          onClick={switchToExpected}
          disabled={isPending}
          className="shrink-0 self-start whitespace-nowrap rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-500 disabled:opacity-50 sm:self-center"
        >
          {isPending ? "Switching…" : buttonLabel}
        </button>
      </div>
      {error && <div className="mt-2 text-xs text-rose-400">{error}</div>}
    </div>
  );
}
