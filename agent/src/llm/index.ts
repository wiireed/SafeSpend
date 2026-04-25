import { OpenAILlm } from "./openai.js";
import { AnthropicLlm } from "./anthropic.js";

export type LlmMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type LlmToolSchema = {
  name: string;
  description: string;
  parameters: object;
};

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: unknown;
};

export type LlmResponse = {
  content: string | null;
  toolCalls: LlmToolCall[];
  stopReason: "stop" | "tool_calls" | "length";
};

export type LlmChatInput = {
  messages: LlmMessage[];
  tools: LlmToolSchema[];
  timeoutMs: number;
};

export interface Llm {
  chat(input: LlmChatInput): Promise<LlmResponse>;
}

export type LlmProvider = "openai" | "anthropic";

export function makeLlm(): Llm {
  const provider = (process.env.LLM_PROVIDER ?? "openai") as LlmProvider;
  if (provider === "openai") {
    return new OpenAILlm({
      apiKey: requireEnv("OPENAI_API_KEY"),
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-codex",
    });
  }
  if (provider === "anthropic") {
    return new AnthropicLlm({
      apiKey: requireEnv("ANTHROPIC_API_KEY"),
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    });
  }
  throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
