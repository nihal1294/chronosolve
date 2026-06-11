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

async function baseUrl(): Promise<string> {
  // Dev override: run the sidecar manually and point the frontend at it.
  const override = import.meta.env.VITE_SOLVER_URL as string | undefined;
  if (override) return override;
  const port = await invoke<number | null>("solver_port");
  if (!port) throw new Error("Solver is still starting — try again in a second");
  return `http://127.0.0.1:${port}`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${await baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

export const solverClient = {
  async health(): Promise<boolean> {
    const response = await fetch(`${await baseUrl()}/health`);
    return response.ok;
  },

  async template(): Promise<string> {
    const response = await fetch(`${await baseUrl()}/template`);
    if (!response.ok) throw new Error(`/template failed (${response.status})`);
    return ((await response.json()) as { yaml: string }).yaml;
  },

  solve(problem: unknown, timeLimit = 60): Promise<SolveResult> {
    return post<SolveResult>("/solve", { problem, time_limit: timeLimit });
  },
};
