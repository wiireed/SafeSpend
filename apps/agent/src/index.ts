/// CLI for the SafeSpend reference agent. Loads env, parses --safe /
/// --vulnerable, streams events from @safespend/agent-core to stdout,
/// and persists the run to apps/agent/.runs/.

import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  runSafeSpendAgent,
  type RunEvent,
  type ProposePurchaseMode,
} from "@safespend/agent-core";

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

  const events: RunEvent[] = [];
  let summary: Extract<RunEvent, { kind: "done" }> | null = null;

  for await (const event of runSafeSpendAgent({ mode })) {
    events.push(event);
    if (event.kind === "done") summary = event;
    else printEvent(event);
  }

  if (!summary) {
    console.error("[error] agent stream ended without a done event");
    process.exit(1);
  }

  console.log(
    `\n[done] runId=${summary.runId} mode=${summary.mode} rounds=${summary.rounds} stop=${summary.stopReason}`,
  );

  await persistRun(summary.runId, summary.mode, events);
}

function printEvent(event: Exclude<RunEvent, { kind: "done" }>): void {
  switch (event.kind) {
    case "model_message":
      console.log(`[model] ${event.content}`);
      break;
    case "tool_call":
      console.log(`[tool->] ${event.name}(${JSON.stringify(event.arguments)})`);
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
}

async function persistRun(
  runId: string,
  mode: ProposePurchaseMode,
  events: RunEvent[],
): Promise<void> {
  // Best-effort: works for the CLI; silently skipped in read-only or
  // serverless filesystems.
  try {
    const dir = join(process.cwd(), "apps", "agent", ".runs");
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${runId}.json`);
    await writeFile(
      file,
      JSON.stringify(
        { runId, mode, completedAt: new Date().toISOString(), events },
        null,
        2,
      ),
    );
  } catch {
    // ignore
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
