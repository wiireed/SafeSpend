import Anthropic from "@anthropic-ai/sdk";
import type { Llm, LlmChatInput, LlmMessage, LlmResponse, LlmToolCall } from "./index.js";

export type AnthropicLlmConfig = {
  apiKey: string;
  model: string;
};

export class AnthropicLlm implements Llm {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: AnthropicLlmConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
  }

  async chat(input: LlmChatInput): Promise<LlmResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const { system, messages } = splitSystem(input.messages);
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: 4096,
          system,
          messages,
          tools: input.tools.length === 0
            ? undefined
            : input.tools.map((t) => ({
                name: t.name,
                description: t.description,
                input_schema: t.parameters as Anthropic.Messages.Tool.InputSchema,
              })),
        },
        { signal: controller.signal },
      );

      const toolCalls: LlmToolCall[] = [];
      let content = "";
      for (const block of response.content) {
        if (block.type === "text") {
          content += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({ id: block.id, name: block.name, arguments: block.input });
        }
      }
      return {
        content: content.length === 0 ? null : content,
        toolCalls,
        stopReason: mapStopReason(response.stop_reason),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

type AnthropicMessageInput = {
  role: "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "tool_use"; id: string; name: string; input: unknown }
        | { type: "tool_result"; tool_use_id: string; content: string }
      >;
};

function splitSystem(messages: LlmMessage[]): {
  system: string | undefined;
  messages: AnthropicMessageInput[];
} {
  const systems = messages.filter((m): m is Extract<LlmMessage, { role: "system" }> => m.role === "system");
  const system = systems.length === 0 ? undefined : systems.map((s) => s.content).join("\n\n");
  const out: AnthropicMessageInput[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      const blocks: AnthropicMessageInput["content"] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      out.push({ role: "assistant", content: blocks });
    } else {
      out.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content }],
      });
    }
  }
  return { system, messages: out };
}

function mapStopReason(reason: string | null): "stop" | "tool_calls" | "length" {
  if (reason === "tool_use") return "tool_calls";
  if (reason === "max_tokens") return "length";
  return "stop";
}
