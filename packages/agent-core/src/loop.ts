/// LLM loop. Async generator that yields a sequence of `LoopEvent`s as the
/// model and tools execute. Consumers can plug into any transport (CLI
/// stdout, SSE, ReadableStream, websockets) by iterating the generator.

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

export type LoopEvent =
  | { kind: "model_message"; content: string }
  | { kind: "tool_call"; id: string; name: string; arguments: unknown }
  | { kind: "tool_result"; id: string; name: string; result: string }
  | { kind: "tool_error"; id: string; name: string; message: string }
  | { kind: "final"; content: string | null }
  | { kind: "rounds_exceeded" }
  | {
      kind: "done";
      rounds: number;
      stopReason: "stop" | "rounds_exceeded";
      finalContent: string | null;
    };

export async function* runAgent(
  input: AgentRunInput,
): AsyncGenerator<LoopEvent, void, void> {
  const { llm, tools, toolHandlers, maxRounds, modelTimeoutMs } = input;

  const messages: LlmMessage[] = [
    { role: "system", content: input.systemPrompt },
    { role: "user", content: input.userPrompt },
  ];

  for (let round = 1; round <= maxRounds; round++) {
    const response = await llm.chat({
      messages,
      tools,
      timeoutMs: modelTimeoutMs,
    });

    if (response.content) yield { kind: "model_message", content: response.content };

    if (response.toolCalls.length === 0) {
      messages.push({ role: "assistant", content: response.content ?? "" });
      yield { kind: "final", content: response.content };
      yield {
        kind: "done",
        rounds: round,
        stopReason: "stop",
        finalContent: response.content,
      };
      return;
    }

    messages.push({
      role: "assistant",
      content: response.content ?? "",
      toolCalls: response.toolCalls,
    });

    for (const call of response.toolCalls) {
      yield {
        kind: "tool_call",
        id: call.id,
        name: call.name,
        arguments: call.arguments,
      };
      const handler = toolHandlers[call.name];
      let resultStr: string;
      if (!handler) {
        resultStr = JSON.stringify({ error: `unknown_tool: ${call.name}` });
        yield { kind: "tool_error", id: call.id, name: call.name, message: resultStr };
      } else {
        try {
          resultStr = await handler(call.arguments);
          yield { kind: "tool_result", id: call.id, name: call.name, result: resultStr };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          resultStr = JSON.stringify({ error: "tool_threw", message: msg });
          yield { kind: "tool_error", id: call.id, name: call.name, message: msg };
        }
      }
      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: resultStr,
      });
    }
  }

  yield { kind: "rounds_exceeded" };
  yield {
    kind: "done",
    rounds: maxRounds,
    stopReason: "rounds_exceeded",
    finalContent: null,
  };
}
