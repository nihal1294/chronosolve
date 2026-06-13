import { useEffect, useState } from "react";
import type { SolveProgress, SolveResult } from "./solver-client";
import type { ProblemEntities } from "./entities";
import type { SolverPhase } from "../components/SolverStateCard";

interface PhaseInputs {
  busy: boolean;
  solveError: string | null;
  result: SolveResult | null;
  entities: ProblemEntities | null;
  /** Live stream snapshot while solving; null before the first solution. */
  progress: SolveProgress | null;
}

interface PhaseState {
  phase: SolverPhase;
  elapsed: number;
  summary: string;
  metrics: [string, string][] | null;
  unresolved: string[];
}

function derivePhase({ busy, solveError, result }: PhaseInputs): SolverPhase {
  if (busy) return "solving";
  if (solveError) return "error";
  return result?.status ?? "idle";
}

function buildSummary(phase: SolverPhase, { solveError, result, entities }: PhaseInputs): string {
  const seconds = result ? `${result.solve_time_seconds.toFixed(2)}s` : "";
  switch (phase) {
    case "idle":
      return entities
        ? `Engine ready. ${entities.subjects.length} courses, ${entities.teachers.length} professors, ` +
            `${entities.groups.length} groups, ${entities.rooms.length} rooms loaded.`
        : "Load or paste a problem definition to begin.";
    case "solving":
      return "Searching for a conflict-free assignment across all hard constraints...";
    case "optimal":
      return `All ${result?.schedule.length ?? 0} sessions scheduled with zero hard-constraint violations in ${seconds}.`;
    case "feasible":
      return `Valid schedule found in ${seconds} - stopped before proving optimality.`;
    case "infeasible":
      return "The solver could not find a valid arrangement. The hard constraints conflict for:";
    case "timeout":
      return `Hit the time limit after ${seconds} without completing the search.`;
    case "error":
      return solveError ?? "Unknown solver error.";
  }
}

/** Derive the Inspector's solver-state model, including a live elapsed timer. */
export function usePhase(inputs: PhaseInputs): PhaseState {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!inputs.busy) return;
    const start = performance.now();
    const update = () => setElapsed((performance.now() - start) / 1000);
    // First update lands on the next frame (resets the display to ~0.0s)
    // so no setState runs synchronously inside the effect body.
    const frame = requestAnimationFrame(update);
    const tick = window.setInterval(update, 100);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(tick);
    };
  }, [inputs.busy]);

  const phase = derivePhase(inputs);
  const { result, progress } = inputs;
  const succeeded = phase === "optimal" || phase === "feasible";

  return {
    phase,
    elapsed,
    summary: buildSummary(phase, inputs),
    metrics: buildMetrics(phase, succeeded, result, progress),
    unresolved: phase === "infeasible" || phase === "timeout" ? (result?.unresolved ?? []) : [],
  };
}

/** Solving shows the live stream; success shows the final result numbers. */
function buildMetrics(
  phase: SolverPhase,
  succeeded: boolean,
  result: SolveResult | null,
  progress: SolveProgress | null,
): [string, string][] | null {
  if (phase === "solving" && progress) {
    return [
      ["Best Objective", String(progress.objective)],
      ["Solutions Found", String(progress.solution_count)],
    ];
  }
  if (succeeded && result) {
    return [
      ["Quality Score", result.quality_score !== null ? String(result.quality_score) : "-"],
      ["Solve Time", `${result.solve_time_seconds.toFixed(2)}s`],
    ];
  }
  return null;
}
