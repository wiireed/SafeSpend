"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortAddress } from "@/lib/format";

/// Smart connector selection:
///   - If a real injected wallet is detected (window.ethereum exists),
///     prefer the `injected` connector — covers desktop with MetaMask
///     extension AND mobile inside MetaMask's in-app browser.
///   - Otherwise fall back to `walletConnect` if it's configured —
///     covers mobile browsers (Safari, Chrome) where MetaMask is a
///     separate app. WalletConnect's QR modal handles the rest.
///
/// Single button UX: judges don't have to think about which wallet.

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="whitespace-nowrap rounded-md bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
        title="Disconnect"
      >
        {shortAddress(address)}
        <span className="hidden sm:inline"> · disconnect</span>
      </button>
    );
  }

  const injectedConnector = connectors.find((c) => c.id === "injected");
  const wcConnector = connectors.find((c) => c.id === "walletConnect");

  if (!injectedConnector && !wcConnector) {
    return <span className="text-sm text-neutral-400">no wallet</span>;
  }

  const handleConnect = () => {
    const hasInjected =
      typeof window !== "undefined" &&
      typeof (window as { ethereum?: unknown }).ethereum !== "undefined";

    if (hasInjected && injectedConnector) {
      connect({ connector: injectedConnector });
    } else if (wcConnector) {
      connect({ connector: wcConnector });
    } else if (injectedConnector) {
      // No window.ethereum AND no walletConnect — try injected anyway
      // (will likely fail, but at least surfaces the standard error).
      connect({ connector: injectedConnector });
    }
  };

  return (
    <button
      onClick={handleConnect}
      disabled={isPending}
      className="whitespace-nowrap rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
    >
      {isPending ? "Connecting…" : "Connect"}
      <span className="hidden sm:inline">&nbsp;wallet</span>
    </button>
  );
}
