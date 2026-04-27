/// SSE consumer for a SafeSpend agent run. Pairs with the
/// /api/run endpoint shipped in apps/merchant — but any endpoint
/// that streams JSON RunEvents over text/event-stream works.
///
/// `RunEvent` is the same shape produced by @safespend/agent-core's
/// runSafeSpendAgent. We don't import the type here to keep this hook
/// usable without an agent-core dep; consumers cast to their own
/// type if needed.

import { useEffect, useRef, useState } from "react";

export type AgentRunStatus = "idle" | "running" | "done" | "error";

export type UseAgentRunOptions<TRunEvent extends { kind: string }> = {
  /// Build the SSE URL. Called each time start() runs so callers can
  /// vary mode/user query params per run.
  buildUrl: () => string;
  /// Optional: invoked once with the final aggregated event list when
  /// the agent emits `{ kind: "done" }`. Useful for persisting runs.
  onDone?: (params: {
    events: TRunEvent[];
    /// The raw `done` event payload — typically includes runId, mode,
    /// rounds, stopReason, finalContent for runSafeSpendAgent.
    done: TRunEvent;
  }) => void;
};

export function useAgentRun<TRunEvent extends { kind: string }>(
  options: UseAgentRunOptions<TRunEvent>,
) {
  const { buildUrl, onDone } = options;
  const [events, setEvents] = useState<TRunEvent[]>([]);
  const [status, setStatus] = useState<AgentRunStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => () => sourceRef.current?.close(), []);

  const start = () => {
    setEvents([]);
    setError(null);
    setStatus("running");

    const source = new EventSource(buildUrl());
    sourceRef.current = source;
    const collected: TRunEvent[] = [];

    source.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data) as TRunEvent & {
          kind: string;
          message?: string;
        };
        if (payload.kind === "done") {
          setStatus("done");
          onDone?.({ events: collected, done: payload });
          source.close();
          return;
        }
        if (payload.kind === "fatal") {
          setStatus("error");
          setError(payload.message ?? "fatal");
          source.close();
          return;
        }
        collected.push(payload);
        setEvents((prev) => [...prev, payload]);
      } catch {
        /* ignore parse errors */
      }
    };
    source.onerror = () => {
      setStatus((s) => {
        if (s !== "running") return s;
        setError("connection lost");
        return "error";
      });
      source.close();
    };
  };

  return { start, events, status, error };
}
