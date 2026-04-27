# @safespend/agent-core

LLM loop, provider adapters, and bundled tool wrappers for the SafeSpend reference agent. Transport-agnostic — returns an async generator. The CLI in [`apps/agent`](../../apps/agent) and the Next.js SSE route in [`apps/merchant`](../../apps/merchant) both consume the same iterator.

## Quickstart

```ts
import { runSafeSpendAgent, type RunEvent } from "@safespend/agent-core";

for await (const event of runSafeSpendAgent({ mode: "safe" })) {
  console.log(event);
  if (event.kind === "done") {
    console.log(`runId=${event.runId} stop=${event.stopReason}`);
  }
}
```

The function reads `CHAIN_ID`, `RPC_URL`, `PRIVATE_KEY`, `USER_ADDRESS`, `VAULT_ADDRESS`, `USDC_ADDRESS`, `LLM_PROVIDER`, `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`) from `process.env`. The merchant SSE route bypasses some of these by passing explicit overrides.

## Event shape

```ts
type RunEvent =
  | { kind: "model_message"; content: string }
  | { kind: "tool_call"; id: string; name: string; arguments: unknown }
  | { kind: "tool_result"; id: string; name: string; result: string }
  | { kind: "tool_error"; id: string; name: string; message: string }
  | { kind: "final"; content: string | null }
  | { kind: "rounds_exceeded" }
  | {
      kind: "done";
      runId: string;
      mode: "safe" | "vulnerable";
      rounds: number;
      stopReason: "stop" | "rounds_exceeded";
      finalContent: string | null;
    };
```

The `done` event is always the last event yielded — consumers can use it as the run-summary capture point.

## BYO marketplace tool

`runSafeSpendAgent` bundles a mock marketplace ([`tools/mockMarketplace.ts`](src/tools/mockMarketplace.ts)) — fine for the demo, not what production consumers want. Drop down to `runAgent` and pass your own:

```ts
import { runAgent, makeLlm } from "@safespend/agent-core";
import {
  proposePurchaseSchema,
  proposePurchase,
} from "@safespend/agent-core/tools/proposePurchase";
import { createVaultClient } from "@safespend/sdk";

const clients = createVaultClient({ ... });

for await (const event of runAgent({
  llm: makeLlm(),
  systemPrompt: "...",
  userPrompt: "...",
  tools: [myMarketplaceSchema, proposePurchaseSchema],
  toolHandlers: {
    searchMyCatalog: async () => myCatalogClient.fetch(),
    proposePurchase: async (raw) =>
      proposePurchase(raw, { mode: "safe", clients, vaultAddress, usdcAddress, userAddress }),
  },
  maxRounds: 8,
  modelTimeoutMs: 60_000,
})) {
  // ...
}
```

## LLM providers

Two adapters ship out of the box, behind a unified `Llm` interface:

- **OpenAI** (default) — set `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, optional `OPENAI_MODEL` (default `gpt-4o-mini`).
- **Anthropic** — set `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` (default `claude-sonnet-4-6`).

Add more by implementing `Llm` from `@safespend/agent-core/llm` and registering in `makeLlm()`.

## What it depends on

- [`@safespend/sdk`](../sdk) — for the safe-spend tx-builder, ENS resolution, listing hash.
- [`@safespend/contracts`](../contracts) — for the typed ABI fragments used inside the proposePurchase tool.
- `openai`, `@anthropic-ai/sdk` — the two bundled provider adapters.

## Surface guard

`@safespend/agent-core` is intentionally LLM-aware (that's the point). It is **not** transport-aware — there are no SSE, WebSocket, or HTTP imports in this package. Consumers wrap the iterator into whatever transport they need.
