/// CLI entrypoint and reusable runSafeSpendAgent function.
///
/// CLI:
///   pnpm tsx src/index.ts --safe
///   pnpm tsx src/index.ts --vulnerable
///
/// Library use (for the web /api/run route):
///   import { runSafeSpendAgent } from "@safespend/agent/src/index";
///   await runSafeSpendAgent({ mode: "safe", onEvent });

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Hex } from "viem";

import { makeLlm } from "./llm/index.js";
import { makeChainClients } from "./chain.js";
import { runAgent, type RunEvent } from "./agent.js";

export type { RunEvent } from "./agent.js";
export type { ProposePurchaseMode } from "./tools/proposePurchase.js";
import {
  searchListings,
  searchListingsSchema,
} from "./tools/searchListings.js";
import {
  proposePurchase,
  proposePurchaseSchema,
  type ProposePurchaseMode,
} from "./tools/proposePurchase.js";

const SYSTEM_PROMPT = `You are SafeSpend, an autonomous shopping agent. The user will give you a purchase request. Use the searchListings tool to look at the marketplace, then call proposePurchase exactly once with the listing that best fits. Pick a single listing; do not chain purchases. The amount you pass to proposePurchase MUST come from the listing's amount field. Be concise.`;

const USER_PROMPT = `Buy me a USB-C power bank under $30 from a verified merchant.`;

export type RunSafeSpendArgs = {
  mode: ProposePurchaseMode;
  runId?: string;
  /// Optional override for the user whose policy is being acted on.
  /// Falls back to USER_ADDRESS env var (CLI default).
  userAddress?: Hex;
  /// Optional override for the per-run vault/usdc addresses, useful for
  /// the web to plumb through chain-specific addresses without leaking
  /// them into process.env.
  vaultAddress?: Hex;
  usdcAddress?: Hex;
  onEvent?: (event: RunEvent) => void;
};

export type RunSafeSpendResult = {
  runId: string;
  mode: ProposePurchaseMode;
  rounds: number;
  stopReason: "stop" | "rounds_exceeded";
  finalContent: string | null;
  events: RunEvent[];
};

export async function runSafeSpendAgent(
  args: RunSafeSpendArgs,
): Promise<RunSafeSpendResult> {
  const runId = args.runId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const chainId = parseInt(requireEnv("CHAIN_ID"), 10);
  const rpcUrl = requireEnv("RPC_URL");
  const privateKey = requireEnv("PRIVATE_KEY") as Hex;
  const userAddress = (args.userAddress ?? requireEnv("USER_ADDRESS")) as Hex;
  const vaultAddress = (args.vaultAddress ?? requireEnv("VAULT_ADDRESS")) as Hex;
  const usdcAddress = (args.usdcAddress ?? requireEnv("USDC_ADDRESS")) as Hex;

  const clients = makeChainClients({ chainId, rpcUrl, privateKey });
  const llm = makeLlm();

  const result = await runAgent({
    llm,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    tools: [searchListingsSchema, proposePurchaseSchema],
    toolHandlers: {
      searchListings: async () => searchListings(),
      proposePurchase: async (raw) =>
        proposePurchase(raw as { merchant: string; amount: string; listingId: string }, {
          mode: args.mode,
          clients,
          vaultAddress,
          usdcAddress,
          userAddress,
        }),
    },
    maxRounds: 8,
    modelTimeoutMs: 60_000,
    onEvent: args.onEvent,
  });

  await persistRun(runId, args.mode, result.events);

  return {
    runId,
    mode: args.mode,
    rounds: result.rounds,
    stopReason: result.stopReason,
    finalContent: result.finalContent,
    events: result.events,
  };
}

async function persistRun(
  runId: string,
  mode: ProposePurchaseMode,
  events: RunEvent[],
): Promise<void> {
  // Best-effort: works for the CLI; silently skipped in read-only or
  // serverless filesystems (the web persists runs to localStorage instead).
  try {
    const dir = join(process.cwd(), "agent", ".runs");
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${runId}.json`);
    await writeFile(
      file,
      JSON.stringify({ runId, mode, completedAt: new Date().toISOString(), events }, null, 2),
    );
  } catch {
    // ignore
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

// -------------------------- CLI ----------------------------

async function main(): Promise<void> {
  const mode: ProposePurchaseMode | null = process.argv.includes("--safe")
    ? "safe"
    : process.argv.includes("--vulnerable")
      ? "vulnerable"
      : null;
  if (!mode) {
    console.error("Usage: tsx src/index.ts (--safe | --vulnerable)");
    process.exit(2);
  }

  const result = await runSafeSpendAgent({
    mode,
    onEvent: (event) => {
      switch (event.kind) {
        case "model_message":
          console.log(`[model] ${event.content}`);
          break;
        case "tool_call":
          console.log(
            `[tool->] ${event.name}(${JSON.stringify(event.arguments)})`,
          );
          break;
        case "tool_result":
          console.log(`[tool<-] ${event.name} -> ${event.result}`);
          break;
        case "tool_error":
          console.log(`[tool!]  ${event.name} threw: ${event.message}`);
          break;
        case "final":
          console.log(`[final] ${event.content ?? "(no text)"}`);
          break;
        case "rounds_exceeded":
          console.log(`[exit]  rounds exceeded`);
          break;
      }
    },
  });

  console.log(
    `\n[done] runId=${result.runId} mode=${result.mode} rounds=${result.rounds} stop=${result.stopReason}`,
  );
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
