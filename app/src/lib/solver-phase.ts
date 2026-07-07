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
