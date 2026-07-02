// HTTP client for the Python solver sidecar.
// Types mirror the Pydantic models in src/timetable_solver/models/schedule.py.

import { invoke } from "@tauri-apps/api/core";
import type { RuleConflict } from "./soften";
import { createSseParser } from "./sse-stream";

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
  /** Clashing softenable hard rules named on an infeasible solve (M7.3). */
  conflicts: RuleConflict[];
}

// 120 x 500ms = 60s. A packaged app's FIRST launch can take ~30-50s while macOS
// validates the bundled solver's native libraries; warm launches are ~6s, so
// this ceiling only bites on a cold first run or a genuine failure. The shell's
// engine-status dot shows "Connecting..." during this window.
const READY_POLLS = 120;
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
  throw new Error("Solver did not start in time - check the app logs.");
}

/** FastAPI wraps errors as {"detail": "..."} - surface the text, not the JSON. */
async function errorDetail(response: Response): Promise<string> {
  const body = await response.text();
  try {
    return (JSON.parse(body) as { detail?: string }).detail ?? body;
  } catch {
    return body; // not JSON - keep the raw body
  }
}

/** A non-2xx response, carrying the status + server detail so callers can branch
 *  on it. /validate maps a schema/load failure to 422 (server.py _parse_problem),
 *  which the validation banner surfaces as a real error rather than an outage. */
export class SolverHttpError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
    message: string,
  ) {
    super(message);
    this.name = "SolverHttpError";
  }
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const response = await fetch(`${await baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const detail = await errorDetail(response);
    throw new SolverHttpError(response.status, detail, `${path} failed (${response.status}): ${detail}`);
  }
  return response.json() as Promise<T>;
}

export interface ValidationReport {
  errors: string[];
  warnings: string[];
}

/** Mirrors scoring/quality.py QualityReport. */
export interface QualityReport {
  overall_score: number;
  hard_violations: string[];
  metrics: Record<string, number>;
  details: Record<string, string[]>;
}

/** One snapshot per improved CP-SAT solution (mirrors solver/callback.py). */
export interface SolveProgress {
  objective: number;
  elapsed: number;
  solution_count: number;
}

export interface SolveStreamOptions {
  onProgress?: (progress: SolveProgress) => void;
  /** Abort to cancel the solve (Cmd+. / palette Halt). */
  signal?: AbortSignal;
}

export const solverClient = {
  async health(): Promise<boolean> {
    const response = await fetch(`${await baseUrl()}/health`, { signal: AbortSignal.timeout(5_000) });
    return response.ok;
  },

  validate(problem: unknown): Promise<ValidationReport> {
    return post<ValidationReport>("/validate", { problem }, 10_000);
  },

  score(problem: unknown, schedule: ScheduleEntry[]): Promise<QualityReport> {
    return post<QualityReport>("/score", { problem, schedule }, 15_000);
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

  /** Solve over SSE: progress per improved solution, one result/error event. */
  async solveStream(
    problem: unknown,
    timeLimit = 60,
    options: SolveStreamOptions = {},
  ): Promise<SolveResult> {
    const timeout = AbortSignal.timeout((timeLimit + 30) * 1_000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const response = await fetch(`${await baseUrl()}/solve/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem, time_limit: timeLimit }),
      signal,
    });
    if (!response.ok || response.body === null) {
      throw new Error(`/solve/stream failed (${response.status}): ${await errorDetail(response)}`);
    }

    let result: SolveResult | null = null;
    let failure: string | null = null;
    const parser = createSseParser(({ event, data }) => {
      if (event === "progress") options.onProgress?.(JSON.parse(data) as SolveProgress);
      else if (event === "result") result = JSON.parse(data) as SolveResult;
      else if (event === "error") failure = (JSON.parse(data) as { message?: string }).message ?? "unknown";
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
      parser.flush();
    } finally {
      // Release the stream even if a malformed payload makes parser.feed throw.
      reader.cancel().catch(() => {});
    }

    if (failure !== null) throw new Error(`Solve failed: ${failure}`);
    if (result === null) throw new Error("Solve stream ended without a result");
    return result;
  },
};
