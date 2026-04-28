/// useNetworkSwitcher — wagmi useSwitchChain wrapped with a fallback to
/// wallet_addEthereumChain for injected providers. The fallback is what
/// MetaMask actually needs when a chain isn't yet added to the user's
/// wallet, and useSwitchChain alone returns silently in that case.

import { useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";

export type ChainSpec = {
  id: number;
  /// Hex chain id, e.g. "0x7a69" for 31337. Used only by the
  /// wallet_addEthereumChain fallback.
  hex: string;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: 18 };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getInjectedEthereum(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum;
}

export type UseNetworkSwitcherResult = {
  /// True iff connected and on a chain other than the expected one.
  needsSwitch: boolean;
  isConnected: boolean;
  currentChainId: number;
  isPending: boolean;
  error: string | null;
  switchToExpected: () => Promise<void>;
};

export function useNetworkSwitcher(options: {
  expectedChain: ChainSpec;
}): UseNetworkSwitcherResult {
  const { expectedChain } = options;
  const { isConnected, connector } = useAccount();
  const currentChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsSwitch = isConnected && currentChainId !== expectedChain.id;

  const switchToExpected = async () => {
    setError(null);
    setBusy(true);
    try {
      // Primary path: ask wagmi to switch via the active connector.
      // Works for both injected (window.ethereum.request) AND
      // walletConnect (relayed to the user's wallet app over the WC
      // tunnel).
      await new Promise<void>((resolve, reject) => {
        // wagmi's switchChain types chainId as the literal union of the
        // host's configured chains, but our hook is portable across hosts —
        // we accept any ChainSpec and trust the runtime check (needsSwitch
        // already verified the chain id is reachable).
        switchChain(
          { chainId: expectedChain.id } as Parameters<typeof switchChain>[0],
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          },
        );
      });
    } catch (switchErr) {
      // Injected fallback: wallet_addEthereumChain is idempotent
      // (MetaMask switches if added, adds + switches if not). Useful when
      // the original switch returned silently because the popup was
      // queued behind another pending notification.
      const isInjected = connector?.id === "injected";
      const eth = isInjected ? getInjectedEthereum() : undefined;

      if (eth) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: expectedChain.hex,
                chainName: expectedChain.name,
                nativeCurrency: expectedChain.nativeCurrency,
                rpcUrls: expectedChain.rpcUrls,
                blockExplorerUrls: expectedChain.blockExplorerUrls ?? [],
              },
            ],
          });
          setBusy(false);
          return;
        } catch (addErr) {
          setError(
            humaniseSwitchError(addErr) ??
              humaniseSwitchError(switchErr) ??
              `Failed to add ${expectedChain.name}. Open your wallet and check for a pending request.`,
          );
          setBusy(false);
          return;
        }
      }

      setError(
        humaniseSwitchError(switchErr) ??
          "Failed to switch network. Open your wallet and check for a pending request.",
      );
    } finally {
      setBusy(false);
    }
  };

  return {
    needsSwitch,
    isConnected,
    currentChainId,
    isPending: busy || isSwitching,
    error,
    switchToExpected,
  };
}

function humaniseSwitchError(err: unknown): string | null {
  if (!err) return null;
  const code = (err as { code?: number }).code;
  const message = (err as { message?: string }).message;
  // 4001 = explicit user rejection. Some wallets return this when the popup
  // is queued and silently dismissed; hint at the common cause rather than
  // blaming the user.
  if (code === 4001) {
    return "The wallet didn't show a prompt. Click your wallet's icon to clear any pending request, then try again.";
  }
  return message ?? null;
}
