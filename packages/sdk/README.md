# @safespend/sdk

Framework-agnostic vault primitives. **viem only — no React, no Next.js, no LLM.**

This is the package a downstream agent project imports if it just wants to call PolicyVault from server-side code. Want React hooks? See [`@safespend/react`](../react). Want a turnkey LLM agent? See [`@safespend/agent-core`](../agent-core).

## What's in here

| Module | What it does |
|---|---|
| `@safespend/sdk/chain` | viem client factory; canonical listing-hash function |
| `@safespend/sdk/ens` | Mainnet ENS forward + reverse resolution with TTL caches |
| `@safespend/sdk/spend` | Preflight simulation, `proposePurchase` tx-builder, typed event decoder |
| `@safespend/sdk/explorer` | URL builders for tx and address pages on supported chains |
| `@safespend/sdk/types` | `Address`, `Hex`, `Policy`, `PolicyInput`, `ReasonCode`, `ChainListing` |
| `@safespend/sdk` (root) | Re-exports the above + `ADDRESSES` / `getAddresses` from `@safespend/contracts` |

## Quickstart

```ts
import {
  createVaultClient,
  computeListingHash,
  proposePurchase,
} from "@safespend/sdk";

const clients = createVaultClient({
  chainId: 31337,
  rpcUrl: "http://127.0.0.1:8545",
  privateKey: "0x...",
});

const result = await proposePurchase({
  clients,
  vaultAddress: "0x...",
  userAddress: "0x...",
  merchant: "0x...",
  amount: 5_000_000n,
  listingHash: computeListingHash({ merchant, amount: 5_000_000n, listingId: "abc" }),
});

// result.status: "approved" | "rejected" | "reverted" | "no_event"
```

A full runnable version lives in [`examples/minimal-agent/`](../../examples/minimal-agent).

## ENS resolution (transport-agnostic)

```ts
import { resolveEns, reverseEns, resolveAddressOrEns } from "@safespend/sdk/ens";

// Each accepts an optional { rpcUrl, timeoutMs, cacheTtlMs }.
// Caller controls its own env-var convention (MAINNET_RPC_URL,
// NEXT_PUBLIC_MAINNET_RPC_URL, hardcoded, etc.) — the SDK doesn't
// pick one for you.
const addr = await resolveEns("merchant-a.safespend.eth", {
  rpcUrl: process.env.MAINNET_RPC_URL,
});
```

## Event decoding

```ts
import { decodeVaultEvent } from "@safespend/sdk/spend";
import type { Log } from "viem";

// log: a viem Log fetched via getLogs / watchContractEvent / receipt.logs
const event = decodeVaultEvent(log);
// event: { eventName: "PurchaseApproved", args: { user, merchant, amount, listingHash, policyVersion } }
//      | { eventName: "PurchaseRejected", args: { ..., reasonCode, reason } }
//      | null  (log isn't a vault event)
```

## Surface guard

```sh
$ grep -rE 'from "react"|from "next"|from "openai"|from "@anthropic-ai"' packages/sdk/src
(0 matches)
```

If you find React, Next.js, or LLM imports in this package, the boundary is broken — please open an issue.

## When to reach for which package

| You want… | Use |
|---|---|
| Server-side vault calls (no UI) | `@safespend/sdk` |
| React hooks for live event feeds, balances, agent runs | `@safespend/react` |
| A turnkey LLM agent that drives the vault | `@safespend/agent-core` |
| To deploy to a new chain | `@safespend/contracts` |
