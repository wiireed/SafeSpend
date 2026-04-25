"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import type { RunEvent } from "@safespend/agent";
import { saveRun } from "@/lib/runs";

export type RunMode = "safe" | "vulnerable";

type Status = "idle" | "running" | "done" | "error";

export function RunPanel({ mode, title, accent }: { mode: RunMode; title: string; accent: "emerald" | "rose" }) {
  const { address } = useAccount();
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => () => sourceRef.current?.close(), []);

  const start = () => {
    if (!address) return;
    setEvents([]);
    setError(null);
    setRunId(null);
    setStatus("running");

    const startedAt = new Date().toISOString();
    const url = `/api/run?mode=${mode}&user=${address}`;
    const source = new EventSource(url);
    sourceRef.current = source;
    const collected: RunEvent[] = [];

    source.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        if (payload.kind === "done") {
          setStatus("done");
          setRunId(payload.runId);
          saveRun({
            runId: payload.runId,
            mode,
            startedAt,
            events: collected,
          });
          source.close();
          return;
        }
        if (payload.kind === "fatal") {
          setStatus("error");
          setError(payload.message);
          source.close();
          return;
        }
        collected.push(payload as RunEvent);
        setEvents((prev) => [...prev, payload as RunEvent]);
      } catch {
        /* ignore parse errors */
      }
    };
    source.onerror = () => {
      if (status === "running") {
        setStatus("error");
        setError("connection lost");
      }
      source.close();
    };
  };

  const accentClass =
    accent === "emerald"
      ? "border-emerald-700/40 bg-emerald-950/20"
      : "border-rose-700/40 bg-rose-950/20";
  const accentBtn =
    accent === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-500"
      : "bg-rose-600 hover:bg-rose-500";

  return (
    <div className={`rounded-lg border p-4 ${accentClass}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-neutral-400">
            {mode === "safe"
              ? "Agent calls PolicyVault.tryProposePurchase. Policy violations come back as on-chain rejections."
              : "Agent transfers MockUSDC directly from a session wallet. No vault."}
          </p>
        </div>
        <button
          onClick={start}
          disabled={!address || status === "running"}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${accentBtn}`}
        >
          {status === "running" && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
            </span>
          )}
          {status === "running" ? "Running" : "Run"}
        </button>
      </div>

      <div className="max-h-[480px] space-y-1.5 overflow-y-auto rounded-md bg-neutral-950/60 p-3 font-mono text-xs">
        {events.length === 0 && status === "idle" && (
          <div className="text-neutral-500">Click Run to start the agent.</div>
        )}
        {events.map((e, i) => (
          <div key={i} className="slide-in-up">
            <EventLine event={e} />
          </div>
        ))}
        {status === "done" && runId && (
          <div className="pt-2 text-neutral-500">
            done · runId {runId.slice(0, 14)}…
          </div>
        )}
        {status === "error" && error && (
          <div className="pt-2 text-rose-400">error: {error}</div>
        )}
      </div>
    </div>
  );
}

function EventLine({ event }: { event: RunEvent }) {
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
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}
