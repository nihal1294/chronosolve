import type { SolveProgress, SolveResult } from "./solver-client";
import type { SolverPhase } from "../components/SolverStateCard";

/** Phase the Scheduler shows. Polishing is a sub-state of a busy solve: the
    sidecar tags each progress event with its phase, and an event without one
    (older sidecar) is plain CP-SAT solving. */
export function deriveSolverPhase(
  solveError: string | null,
  busy: boolean,
  progress: SolveProgress | null,
  result: SolveResult | null,
): SolverPhase {
  if (solveError) return "error";
  if (busy) return progress?.phase === "polishing" ? "polishing" : "solving";
  return result ? result.status : "idle";
}

/** Labels + values for the busy metrics card. Polish events carry the 0-100
    quality score in `objective` (not a CP-SAT objective) and an iteration
    instead of a solution count, so the wording flips with the phase. */
export function busyMetrics(
  phase: SolverPhase,
  progress: SolveProgress | null,
  lastObjective?: number | null,
): [string, string][] {
  if (phase === "polishing") {
    return [
      ["Best quality", progress ? `${progress.objective} / 100` : "-"],
      ["Polish iteration", String(progress?.iteration ?? 0)],
    ];
  }
  return [
    ["Best objective", (progress?.objective ?? lastObjective)?.toLocaleString() ?? "-"],
    ["Solutions found", String(progress?.solution_count ?? 0)],
  ];
}
