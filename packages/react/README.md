# @safespend/react

Headless React hooks for vault integration. Each hook returns plain data — no JSX, no styling, no opinionated CSS. Pair with your own components.

Peer deps: `react ^19`, `viem ^2`, `wagmi ^2`. The host app provides the wagmi config; this package consumes whichever one is wired.

## Hooks

```ts
import {
  useEnsLabel,
  useVaultEvents,
  useVaultBalances,
  useAgentRun,
  useNetworkSwitcher,
  usePolicy,
  usePolicySetter,
  useVaultActivityHistory,
} from "@safespend/react";
```

### `useEnsLabel(address, { overrides?, rpcUrl? })`

Display hook for a single address. Returns the override (if present), then mainnet reverse-resolution, then null.

```tsx
const label = useEnsLabel(merchant, {
  overrides: { "0x90f7…": "merchant-a.safespend.eth" },
  rpcUrl: process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
});
```

### `useVaultEvents({ vaultAddress, limit? })`

Live `PurchaseApproved` + `PurchaseRejected` feed via wagmi's public client. Returns a typed `VaultFeedEntry[]` (newest first), capped at `limit` (default 20).

```tsx
const entries = useVaultEvents({ vaultAddress: addrs.vault });
return <ul>{entries.map(e => /* … */)}</ul>;
```

### `useVaultBalances({ usdcAddress, addresses, refetchIntervalMs? })`

USDC balance reader for an arbitrary set of addresses. Returns `{ balances: Map<string, bigint>, isLoading }` keyed by lowercased address. Auto-refetches; default 3 s.

```tsx
const { balances } = useVaultBalances({
  usdcAddress: addrs.usdc,
  addresses: [user, vault, agent, ...merchants],
});
const userBalance = balances.get(user.toLowerCase()) ?? 0n;
```

### `useAgentRun<TRunEvent>({ buildUrl, onDone? })`

Generic SSE consumer for agent runs. Designed to pair with [`@safespend/agent-core`](../agent-core)'s `runSafeSpendAgent` over an SSE endpoint, but works with any text/event-stream that yields `{ kind: string }` payloads.

```tsx
import type { RunEvent } from "@safespend/agent-core";

const { start, events, status, error } = useAgentRun<RunEvent>({
  buildUrl: () => `/api/run?mode=safe&user=${user}`,
  onDone: ({ events, done }) => persistRun({ ...done, events }),
});
```

The hook intercepts `{ kind: "done" }` and `{ kind: "fatal" }` payloads and surfaces them via `status` + `onDone` / `error`. Other kinds flow into `events`.

### `useNetworkSwitcher({ expectedChain })`

Wraps wagmi's `useSwitchChain` with the injected-provider `wallet_addEthereumChain` fallback. The fallback is what MetaMask actually needs when the chain hasn't been added to the user's wallet, and the bare wagmi call returns silently in that case.

```tsx
import { useNetworkSwitcher, type ChainSpec } from "@safespend/react";

const FUJI: ChainSpec = {
  id: 43113, hex: "0xa869", name: "Avalanche Fuji",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
  blockExplorerUrls: ["https://testnet.snowtrace.io"],
};

const { needsSwitch, isPending, error, switchToExpected } =
  useNetworkSwitcher({ expectedChain: FUJI });

if (!needsSwitch) return null;
return <button onClick={switchToExpected}>{isPending ? "…" : "Switch to Fuji"}</button>;
```

### `usePolicy({ vaultAddress, user, refetchIntervalMs? })`

Read the current vault policy for a user. `isUnset` flags `version === 0n` (never called `setPolicy`) so onboarding flows can branch on it cleanly.

```tsx
const { policy, isLoading, isUnset } = usePolicy({
  vaultAddress: addrs.vault,
  user: address,
});
if (isUnset) return <Onboarding />;
```

### `usePolicySetter({ vaultAddress })`

Glues `useWriteContract` + `useWaitForTransactionReceipt` for `setPolicy`. Form state stays in the host (the merchant's `PolicyDialog` keeps its ENS-resolution-staging UI inline because that's not a vault concern).

```tsx
const { setPolicy, isPending, isConfirming, isSuccess, error } =
  usePolicySetter({ vaultAddress: addrs.vault });

const submit = () => setPolicy({
  maxPerTx, maxTotal, expiresAt, authorizedAgent, allowedMerchants,
});
```

### `useVaultActivityHistory({ vaultAddress, chain, rpcUrl, historyBlocks?, refetchIntervalMs? })`

Historical `PurchaseApproved` + `PurchaseRejected` events with block timestamps joined in. Independent of the wallet's connected chain — caller passes a viem chain + RPC, the hook builds its own public client. Auto-refreshes; default 60 s.

```tsx
import { avalancheFuji } from "viem/chains";

const { entries, status, latestBlock } = useVaultActivityHistory({
  vaultAddress: FUJI_VAULT,
  chain: avalancheFuji,
  rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
});
```

## Surface guard

```sh
$ grep -rE 'from "next"|from "openai"|from "@anthropic-ai"' packages/react/src
(0 matches)
```

This package has no Next.js or LLM-provider imports. It also has no styling — use whatever component lib or hand-rolled CSS your app uses.
