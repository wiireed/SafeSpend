"use client";

import { useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";

/// Same chain shapes wagmi uses internally — kept here to feed the
/// fallback wallet_addEthereumChain path for old injected providers
/// that don't auto-add chains via wagmi.

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

function getExpectedChain(): ChainSpec {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID;
  const id = raw ? parseInt(raw, 10) : 31337;
  if (id === 43113) return FUJI;
  return ANVIL;
}

export function NetworkHelper() {
  const { isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expected = getExpectedChain();

  if (!isConnected) return null;
  if (chainId === expected.id) return null;

  const onClick = async () => {
    setError(null);
    setBusy(true);
    try {
      // Primary path: ask wagmi to switch via the active connector.
      // Works for both injected (window.ethereum.request) AND
      // walletConnect (relayed to the user's wallet app over the
      // WC tunnel). A WalletConnect MetaMask user gets a deep-link
      // prompt to confirm the switch in the MetaMask app.
      await new Promise<void>((resolve, reject) => {
        switchChain(
          { chainId: expected.id as 31337 | 43113 },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          },
        );
      });
    } catch (switchErr) {
      // Fallback for the case where the wallet supports the chain ID
      // but doesn't have it added to its network list. Only applies
      // to injected providers — WalletConnect's MetaMask app will
      // typically prompt to add the chain itself, so we don't need
      // to call wallet_addEthereumChain via the relay.
      const code = (switchErr as { code?: number })?.code;
      const isUnrecognised = code === 4902 || code === -32603;
      const isInjected = connector?.id === "injected";

      if (isUnrecognised && isInjected) {
        const eth = getEthereum();
        if (eth) {
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
            setBusy(false);
            return;
          } catch (addErr) {
            setError(
              (addErr as { message?: string })?.message ??
                `Failed to add ${expected.name}.`,
            );
            setBusy(false);
            return;
          }
        }
      }

      setError(
        (switchErr as { message?: string })?.message ??
          "Failed to switch network.",
      );
    } finally {
      setBusy(false);
    }
  };

  const isAnvil = expected.id === 31337;
  const subtext = isAnvil
    ? "MetaMask may warn that chain ID 31337 looks like “GoChain Testnet” — that’s a cosmetic registry collision and safe to approve for local Anvil."
    : "Avalanche Fuji is a public testnet — you’ll need testnet AVAX from the Core faucet to interact.";

  const isPending = busy || isSwitching;
  const buttonLabel = isAnvil ? "Switch to Anvil" : "Switch to Fuji";

  return (
    <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="font-medium text-amber-200">
            Wallet is on chain {chainId} — switch to {expected.name} to use the demo.
          </div>
          <div className="mt-0.5 text-xs text-amber-300/80">{subtext}</div>
        </div>
        <button
          onClick={onClick}
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
