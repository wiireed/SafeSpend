import type { Llm, LlmMessage, LlmToolSchema } from "./llm/index.js";

export type AgentRunInput = {
  llm: Llm;
  systemPrompt: string;
  userPrompt: string;
  tools: LlmToolSchema[];
  toolHandlers: Record<string, (args: unknown) => Promise<string>>;
  maxRounds: number;
  modelTimeoutMs: number;
  onEvent?: (event: RunEvent) => void;
};

export type RunEvent =
  | { kind: "model_message"; content: string }
  | { kind: "tool_call"; id: string; name: string; arguments: unknown }
  | { kind: "tool_result"; id: string; name: string; result: string }
  | { kind: "tool_error"; id: string; name: string; message: string }
  | { kind: "final"; content: string | null }
  | { kind: "rounds_exceeded" };

export type AgentRunResult = {
  transcript: LlmMessage[];
  events: RunEvent[];
  finalContent: string | null;
  rounds: number;
  stopReason: "stop" | "rounds_exceeded";
};

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const { llm, tools, toolHandlers, maxRounds, modelTimeoutMs, onEvent } = input;
  const events: RunEvent[] = [];
  const emit = (e: RunEvent) => {
    events.push(e);
    onEvent?.(e);
  };

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

    if (response.content) emit({ kind: "model_message", content: response.content });

    if (response.toolCalls.length === 0) {
      messages.push({
        role: "assistant",
        content: response.content ?? "",
      });
      emit({ kind: "final", content: response.content });
      return {
        transcript: messages,
        events,
        finalContent: response.content,
        rounds: round,
        stopReason: "stop",
      };
    }

    messages.push({
      role: "assistant",
      content: response.content ?? "",
      toolCalls: response.toolCalls,
    });

    for (const call of response.toolCalls) {
      emit({
        kind: "tool_call",
        id: call.id,
        name: call.name,
        arguments: call.arguments,
      });
      const handler = toolHandlers[call.name];
      let resultStr: string;
      if (!handler) {
        resultStr = JSON.stringify({ error: `unknown_tool: ${call.name}` });
        emit({ kind: "tool_error", id: call.id, name: call.name, message: resultStr });
      } else {
        try {
          resultStr = await handler(call.arguments);
          emit({ kind: "tool_result", id: call.id, name: call.name, result: resultStr });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          resultStr = JSON.stringify({ error: "tool_threw", message: msg });
          emit({ kind: "tool_error", id: call.id, name: call.name, message: msg });
        }
      }
      messages.push({
        role: "tool",
        toolCallId: call.id,
        content: resultStr,
      });
    }
  }

  emit({ kind: "rounds_exceeded" });
  return {
    transcript: messages,
    events,
    finalContent: null,
    rounds: maxRounds,
    stopReason: "rounds_exceeded",
  };
}
