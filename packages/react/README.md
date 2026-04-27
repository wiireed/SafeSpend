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

## Surface guard

```sh
$ grep -rE 'from "next"|from "openai"|from "@anthropic-ai"' packages/react/src
(0 matches)
```

This package has no Next.js or LLM-provider imports. It also has no styling — use whatever component lib or hand-rolled CSS your app uses.

## What's missing

The plan calls for 8 hooks; 4 are landed. Tracked for follow-up:

- `useNetworkSwitcher` — wagmi `useSwitchChain` + `wallet_addEthereumChain` fallback for injected providers.
- `usePolicy(user)` / `usePolicySetter()` — vault policy read + write.
- `useVaultActivityHistory({ fromBlock, toBlock })` — historical `getContractEvents` with block-timestamp join.

For now, see the inline equivalents in [`apps/merchant/components/NetworkHelper.tsx`](../../apps/merchant/components/NetworkHelper.tsx), [`PolicyDialog.tsx`](../../apps/merchant/components/PolicyDialog.tsx), and [`app/activity/page.tsx`](../../apps/merchant/app/activity/page.tsx).
