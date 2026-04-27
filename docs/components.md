# SafeSpend as a component

SafeSpend started as a hackathon submission and is now a reusable on-chain component. This doc explains the package layout, the trust-boundary thesis behind the design, and how to integrate the safe-spend pattern in your own project.

## The thesis: PolicyVault is the trust boundary

> The agent can be tricked. The wallet cannot.

Prompt injection lets a hostile listing convince an LLM to do anything it has the authority to do. The fix isn't a smarter agent — it's bounding the agent's authority on-chain so prompt injection cannot exfiltrate funds beyond what the user's policy allows.

`PolicyVault` is that boundary:

- **The user** sets a policy — per-tx limit, total budget, expiry, authorized agent EOA, merchant allowlist.
- **The agent** holds a session key with no spending authority of its own. It calls `PolicyVault.tryProposePurchase`, which the contract evaluates against the policy before moving any USDC. Violations come back as `PurchaseRejected` events; approvals come back as `PurchaseApproved` events with a tx hash.
- **The merchant** receives the USDC iff the policy passes. The agent never holds custody.

Everything in `packages/` exists to make that boundary easy to consume.

## Package layout

```
packages/
  contracts/      Foundry project + ABIs + deployed addresses (chain-truth layer)
  sdk/            Framework-agnostic vault primitives (viem only — no React, no LLM)
  agent-core/     LLM loop + provider adapters + bundled tool wrappers
  react/          Headless React hooks (peer deps: react, wagmi, viem)
apps/
  agent/          Reference CLI consumer of agent-core
  merchant/       Reference Next.js app consuming sdk + react + agent-core
examples/
  minimal-agent/  Smallest sdk integration — proves framework-agnosticism
```

### Dependency direction (top → bottom: layers; arrows = `depends on`)

```
apps/merchant ─┬─→ @safespend/react ─┐
               ├─→ @safespend/agent-core ─┐
               └─→ @safespend/sdk ────────┴───→ @safespend/contracts
apps/agent ──→ @safespend/agent-core ─→ @safespend/sdk ─→ @safespend/contracts
examples/minimal-agent ─→ @safespend/sdk ─→ @safespend/contracts
```

Nothing under `packages/` depends on anything in `apps/` or `examples/`. The SDK and React packages have no LLM or Next.js coupling. The agent-core has no transport coupling (returns an async generator; consumers wrap as needed).

## Package boundaries (the design rules)

These hold across every package. Any change that violates them gets caught by surface-guard greps in CI.

1. **`@safespend/contracts` is the chain-truth layer.** ABIs and addresses live here. Other packages re-export for ergonomics, but the source of truth is one place.
2. **`@safespend/sdk` is viem-only.** No React, no Next.js, no LLM. If a helper needs React or wagmi, it belongs in `@safespend/react`.
3. **`@safespend/react` is hooks-only.** No styling, no opinionated CSS. No bundled wagmi config — the host app provides it.
4. **`@safespend/agent-core` is transport-agnostic.** Returns async iterables, not SSE / callbacks. Consumers (CLI, SSE endpoint, anything else) wrap as needed.
5. **No demo data in public packages.** `ANVIL_ACCOUNTS` / `ANVIL_PRIVATE_KEYS` live in `apps/merchant/lib/anvil.ts`, not in `@safespend/contracts`.

### Surface-guard greps

```sh
# SDK has zero React/Next/LLM imports
grep -rE 'from "react"|from "next"|from "openai"|from "@anthropic-ai"' packages/sdk/src

# React package has zero Next/LLM imports
grep -rE 'from "next"|from "openai"|from "@anthropic-ai"' packages/react/src

# Contracts package has zero deps beyond viem
grep -rE 'from "react"|from "next"|from "openai"|from "@anthropic-ai"' packages/contracts/src
```

All three should return zero matches.

## Integration recipes

### "I want to call the vault from my own backend"

You only need [`@safespend/sdk`](../packages/sdk).

```ts
import { createVaultClient, computeListingHash, proposePurchase } from "@safespend/sdk";

const clients = createVaultClient({ chainId, rpcUrl, privateKey });

const result = await proposePurchase({
  clients,
  vaultAddress,
  userAddress,
  merchant,
  amount,
  listingHash: computeListingHash({ merchant, amount, listingId }),
});

// result: { status: "approved" | "rejected" | "reverted" | "no_event", ... }
```

See [`examples/minimal-agent/`](../examples/minimal-agent) for a runnable version.

### "I want a turnkey SafeSpend agent in my Next.js app"

You want [`@safespend/agent-core`](../packages/agent-core) + [`@safespend/react`](../packages/react).

Server-side route:

```ts
// app/api/run/route.ts
import { runSafeSpendAgent } from "@safespend/agent-core";

export async function GET(req: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      for await (const event of runSafeSpendAgent({ mode: "safe", ... })) {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}
```

Client-side panel:

```tsx
"use client";
import { useAgentRun } from "@safespend/react";
import type { RunEvent } from "@safespend/agent-core";

export function MyRunPanel() {
  const { start, events, status } = useAgentRun<RunEvent>({
    buildUrl: () => "/api/run",
    onDone: ({ events, done }) => /* persist or report */ undefined,
  });
  return <button onClick={start}>{status === "running" ? "..." : "Run"}</button>;
}
```

### "I want to BYO marketplace tool"

Use the lower-level `runAgent` from `@safespend/agent-core/loop`:

```ts
import { runAgent, makeLlm } from "@safespend/agent-core";
import { proposePurchaseSchema, proposePurchase } from "@safespend/agent-core/tools/proposePurchase";
import { createVaultClient } from "@safespend/sdk";

// Define your own marketplace tool
const myMarketplaceSchema = { name: "searchMyCatalog", description: "...", parameters: { ... } };

for await (const event of runAgent({
  llm: makeLlm(),
  systemPrompt: "...",
  userPrompt: "...",
  tools: [myMarketplaceSchema, proposePurchaseSchema],
  toolHandlers: {
    searchMyCatalog: async () => myCatalogClient.fetch(),
    proposePurchase: async (raw) => proposePurchase(raw, deps),
  },
  maxRounds: 8,
  modelTimeoutMs: 60_000,
})) {
  // ...
}
```

`@safespend/agent-core` ships with `searchListings` (mock marketplace) for the demo, but production consumers should swap their own.

### "I want a vault on a new chain"

See [`docs/contracts/new-chain-deploy.md`](contracts/new-chain-deploy.md). The TL;DR:

1. `forge script` deploy `MockUSDC` + `PolicyVault` on the new chain.
2. Add the chain to `SupportedChainId` in `packages/contracts/src/addresses.ts` and to `EXPLORERS` in `packages/sdk/src/explorer.ts`.
3. Add the chain to `pickChain` in `packages/sdk/src/chain.ts` so `createVaultClient` can resolve it via viem.

## Hackathon snapshot

The original hackathon submission is preserved at the [`v0.1.0-hackathon`](https://github.com/wiireed/SafeSpend/releases/tag/v0.1.0-hackathon) tag and the [`hackathon`](https://github.com/wiireed/SafeSpend/tree/hackathon) branch (commit `9c887fb`). The `main` branch from there onward is the component refactor — same contracts, same UX, but the supporting code split into the four packages above.
