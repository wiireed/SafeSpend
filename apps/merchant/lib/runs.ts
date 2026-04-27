/// localStorage helpers for persisting agent runs in the browser.

import type { RunEvent } from "@safespend/agent-core";

const KEY = "safespend.runs.v1";

export type StoredRun = {
  runId: string;
  mode: "safe" | "vulnerable";
  startedAt: string;
  events: RunEvent[];
};

export function loadRuns(): StoredRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredRun[];
  } catch {
    return [];
  }
}

export function saveRun(run: StoredRun): void {
  if (typeof window === "undefined") return;
  const all = loadRuns();
  all.unshift(run);
  // Keep the latest 50 runs.
  const trimmed = all.slice(0, 50);
  window.localStorage.setItem(KEY, JSON.stringify(trimmed));
}
