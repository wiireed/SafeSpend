/// Top-level entry: wires up an LLM, vault clients, and the bundled
/// safe-spend tools, then yields a stream of `RunEvent`s. Transport-
/// agnostic — wrap with SSE in a Next.js route, with stdout in a CLI,
/// or with anything else.

import type { Hex } from "viem";
import { createVaultClient } from "@safespend/sdk/chain";

import { makeLlm } from "./llm/index.js";
import { runAgent, type LoopEvent } from "./loop.js";
import {
  searchListings,
  searchListingsSchema,
} from "./tools/mockMarketplace.js";
import {
  proposePurchase,
  proposePurchaseSchema,
  type ProposePurchaseMode,
} from "./tools/proposePurchase.js";

export type { LoopEvent, AgentRunInput } from "./loop.js";
export { runAgent } from "./loop.js";
export type { ProposePurchaseMode } from "./tools/proposePurchase.js";
export type {
  Llm,
  LlmMessage,
  LlmToolSchema,
  LlmToolCall,
  LlmResponse,
  LlmProvider,
} from "./llm/index.js";

/// Public event stream for `runSafeSpendAgent`. The `done` event carries the
/// caller-facing run identity (runId + mode) on top of the loop-level fields.
export type RunEvent =
  | Exclude<LoopEvent, { kind: "done" }>
  | {
      kind: "done";
      rounds: number;
      stopReason: "stop" | "rounds_exceeded";
      finalContent: string | null;
      runId: string;
      mode: ProposePurchaseMode;
    };

const DEFAULT_SYSTEM_PROMPT = `You are SafeSpend, an autonomous shopping agent. The user will give you a purchase request. Use the searchListings tool to look at the marketplace, then call proposePurchase exactly once with the listing that best fits. Pick a single listing; do not chain purchases. The amount you pass to proposePurchase MUST come from the listing's amount field. When a listing has a merchantEns field, prefer passing that ENS name to proposePurchase as the merchant — it is the merchant's verified human-readable identity. Otherwise pass the raw merchant address. Be concise.`;

const DEFAULT_USER_PROMPT = `Buy me a USB-C power bank under $30 from a verified merchant. Find the best deal.`;

export type RunSafeSpendArgs = {
  mode: ProposePurchaseMode;
  /// Optional explicit runId. Defaults to a freshly-generated id.
  runId?: string;
  /// Optional override for the user whose policy is being acted on.
  /// Falls back to USER_ADDRESS env var.
  userAddress?: Hex;
  /// Optional address overrides; useful for the web to plumb through
  /// chain-specific addresses without leaking them into process.env.
  vaultAddress?: Hex;
  usdcAddress?: Hex;
  /// Optional prompt overrides — defaults to the bundled SafeSpend demo.
  systemPrompt?: string;
  userPrompt?: string;
  /// Caps. Defaults: 8 rounds, 60s per model call.
  maxRounds?: number;
  modelTimeoutMs?: number;
};

export async function* runSafeSpendAgent(
  args: RunSafeSpendArgs,
): AsyncGenerator<RunEvent, void, void> {
  const runId =
    args.runId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const chainId = parseInt(requireEnv("CHAIN_ID"), 10);
  const rpcUrl = requireEnv("RPC_URL");
  const privateKey = requireEnv("PRIVATE_KEY") as Hex;
  const userAddress = (args.userAddress ?? requireEnv("USER_ADDRESS")) as Hex;
  const vaultAddress = (args.vaultAddress ?? requireEnv("VAULT_ADDRESS")) as Hex;
  const usdcAddress = (args.usdcAddress ?? requireEnv("USDC_ADDRESS")) as Hex;

  const clients = createVaultClient({ chainId, rpcUrl, privateKey });
  const llm = makeLlm();

  for await (const event of runAgent({
    llm,
    systemPrompt: args.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    userPrompt: args.userPrompt ?? DEFAULT_USER_PROMPT,
    tools: [searchListingsSchema, proposePurchaseSchema],
    toolHandlers: {
      searchListings: async () => searchListings(),
      proposePurchase: async (raw) =>
        proposePurchase(
          raw as { merchant: string; amount: string; listingId: string },
          {
            mode: args.mode,
            clients,
            vaultAddress,
            usdcAddress,
            userAddress,
          },
        ),
    },
    maxRounds: args.maxRounds ?? 8,
    modelTimeoutMs: args.modelTimeoutMs ?? 60_000,
  })) {
    if (event.kind === "done") {
      yield { ...event, runId, mode: args.mode };
    } else {
      yield event;
    }
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
