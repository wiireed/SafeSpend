"use client";

import type { RunEvent } from "@safespend/agent-core";

/// Per-event renderer for the agent run feed. The `done` event is
/// intercepted by useAgentRun before reaching here; rendering it would
/// mean it slipped through.

export function RunEventLine({ event }: { event: RunEvent }) {
  switch (event.kind) {
    case "model_message":
      return (
        <div>
          <span className="text-neutral-500">[model] </span>
          <span className="whitespace-pre-wrap text-neutral-200">{event.content}</span>
        </div>
      );
    case "tool_call":
      return (
        <div>
          <span className="text-emerald-400">[tool→] </span>
          <span className="text-neutral-200">
            {event.name}({JSON.stringify(event.arguments)})
          </span>
        </div>
      );
    case "tool_result":
      return (
        <div>
          <span className="text-cyan-400">[tool←] </span>
          <span className="text-neutral-300">
            {event.name} → {truncate(event.result, 240)}
          </span>
        </div>
      );
    case "tool_error":
      return (
        <div>
          <span className="text-rose-400">[tool!] </span>
          <span className="text-rose-300">
            {event.name} threw: {event.message}
          </span>
        </div>
      );
    case "final":
      return (
        <div>
          <span className="text-emerald-300">[final] </span>
          <span className="text-neutral-100">{event.content ?? "(no text)"}</span>
        </div>
      );
    case "rounds_exceeded":
      return <div className="text-rose-400">[exit] rounds exceeded</div>;
    case "done":
      return null;
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}
