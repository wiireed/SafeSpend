import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import type { Llm, LlmChatInput, LlmMessage, LlmResponse, LlmToolCall } from "./index.js";

export type OpenAILlmConfig = {
  apiKey: string;
  model: string;
};

export class OpenAILlm implements Llm {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: OpenAILlmConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model;
  }

  async chat(input: LlmChatInput): Promise<LlmResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          messages: input.messages.map(toOpenAIMessage),
          tools: input.tools.length === 0 ? undefined : input.tools.map(toOpenAITool),
          tool_choice: input.tools.length === 0 ? undefined : "auto",
        },
        { signal: controller.signal },
      );
      const choice = response.choices[0];
      if (!choice) throw new Error("OpenAI returned no choices");
      const message = choice.message;
      const toolCalls: LlmToolCall[] =
        message.tool_calls?.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: safeJsonParse(tc.function.arguments),
        })) ?? [];
      return {
        content: message.content ?? null,
        toolCalls,
        stopReason: mapStopReason(choice.finish_reason),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function toOpenAIMessage(msg: LlmMessage): ChatCompletionMessageParam {
  switch (msg.role) {
    case "system":
      return { role: "system", content: msg.content };
    case "user":
      return { role: "user", content: msg.content };
    case "assistant":
      return {
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls?.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      };
    case "tool":
      return { role: "tool", tool_call_id: msg.toolCallId, content: msg.content };
  }
}

function toOpenAITool(schema: { name: string; description: string; parameters: object }): ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters as Record<string, unknown>,
    },
  };
}

function mapStopReason(reason: string | null): "stop" | "tool_calls" | "length" {
  if (reason === "tool_calls") return "tool_calls";
  if (reason === "length") return "length";
  return "stop";
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
