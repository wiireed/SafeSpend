"use client";

import { useAccount } from "wagmi";
import type { RunEvent } from "@safespend/agent-core";
import { useAgentRun } from "@safespend/react";
import { RunEventLine } from "./RunEventLine";
import { saveRun } from "@/lib/runs";

export type RunMode = "safe" | "vulnerable";

export function RunPanel({ mode, title, accent }: { mode: RunMode; title: string; accent: "emerald" | "rose" }) {
  const { address } = useAccount();

  const { start, events, status, error } = useAgentRun<RunEvent>({
    buildUrl: () => `/api/run?mode=${mode}&user=${address}`,
    onDone: ({ events: all, done }) => {
      if (done.kind !== "done") return;
      saveRun({
        runId: done.runId,
        mode,
        startedAt: new Date().toISOString(),
        events: all,
      });
    },
  });

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
            <RunEventLine event={e} />
          </div>
        ))}
        {status === "done" && (
          <div className="pt-2 text-neutral-500">done</div>
        )}
        {status === "error" && error && (
          <div className="pt-2 text-rose-400">error: {error}</div>
        )}
      </div>
    </div>
  );
}
