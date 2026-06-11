// HTTP client for the Python solver sidecar.
// Types mirror the Pydantic models in src/timetable_solver/models/schedule.py.

import { invoke } from "@tauri-apps/api/core";

export interface ScheduleEntry {
  subject_id: string;
  day: string;
  slot: number;
  teacher_ids: string[];
  group_ids: string[];
  room_id: string | null;
}

export interface SolveResult {
  status: "optimal" | "feasible" | "infeasible" | "timeout";
  schedule: ScheduleEntry[];
  quality_score: number | null;
  solve_time_seconds: number;
  unresolved: string[];
}

const READY_POLLS = 20;
const READY_POLL_MS = 500;

async function baseUrl(): Promise<string> {
  // Dev override: run the sidecar manually and point the frontend at it.
  const override = import.meta.env.VITE_SOLVER_URL as string | undefined;
  if (override) return override;
  // The sidecar announces its port shortly after launch; poll instead of
  // failing the user's first click during that startup window.
  for (let attempt = 0; attempt < READY_POLLS; attempt++) {
    const port = await invoke<number | null>("solver_port");
    if (port) return `http://127.0.0.1:${port}`;
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }
  throw new Error("Solver did not start within 10s — check the app logs (is uv on PATH?)");
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const response = await fetch(`${await baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

export const solverClient = {
  async health(): Promise<boolean> {
    const response = await fetch(`${await baseUrl()}/health`, { signal: AbortSignal.timeout(5_000) });
    return response.ok;
  },

  async template(): Promise<string> {
    const response = await fetch(`${await baseUrl()}/template`, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error(`/template failed (${response.status})`);
    return ((await response.json()) as { yaml: string }).yaml;
  },

  solve(problem: unknown, timeLimit = 60): Promise<SolveResult> {
    // Solves legitimately run up to time_limit; only guard against a wedged server.
    return post<SolveResult>("/solve", { problem, time_limit: timeLimit }, (timeLimit + 30) * 1_000);
  },
};
