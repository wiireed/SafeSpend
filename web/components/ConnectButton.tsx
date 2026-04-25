"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortAddress } from "@/lib/format";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
      >
        {shortAddress(address)} · disconnect
      </button>
    );
  }

  const injected = connectors.find((c) => c.id === "injected");
  if (!injected) {
    return <span className="text-sm text-neutral-400">no injected wallet</span>;
  }

  return (
    <button
      onClick={() => connect({ connector: injected })}
      disabled={isPending}
      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
