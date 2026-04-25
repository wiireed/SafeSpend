/// Agent loop orchestration. Wired in PR 3.
import type { Llm, LlmMessage, LlmToolSchema } from "./llm/index.js";

export type AgentRunInput = {
  llm: Llm;
  systemPrompt: string;
  userPrompt: string;
  tools: LlmToolSchema[];
  toolHandlers: Record<string, (args: unknown) => Promise<string>>;
  maxRounds: number;
  modelTimeoutMs: number;
};

export type AgentRunResult = {
  transcript: LlmMessage[];
  finalContent: string | null;
  rounds: number;
};

export async function runAgent(_input: AgentRunInput): Promise<AgentRunResult> {
  throw new Error("runAgent: implementation lands in PR 3");
}
