import type { ProblemEntities } from "./entities";
import type { SolveResult } from "./solver-client";

export interface DashboardMetrics {
  courses: number;
  instructors: number;
  rooms: number;
  groups: number;
  /** Total teaching hours/week the problem demands (sum of subject hours). */
  weeklyHours: number;
  hasData: boolean;
  solveStatus: SolveResult["status"] | null;
  qualityScore: number | null;
  /** true once a feasible/optimal solution exists (CP-SAT guarantees hard
      constraints there), false when no schedule yet (infeasible OR timeout),
      null before any solve. Use solveOutcome to tell timeout from infeasible. */
  hardConstraintsMet: boolean | null;
}

/** The Dashboard's output-step state. Timeout is kept SEPARATE from infeasible:
    a timeout means CP-SAT ran out of time without finding or disproving a
    schedule (rerun / raise the limit), whereas infeasible means it proved none
    exists (fix the data or constraints). Collapsing both into one "failed"
    branch wrongly tells a timed-out user to change their inputs. */
export type SolveOutcome = "pending" | "running" | "solved" | "timeout" | "infeasible";

export function solveOutcome(metrics: DashboardMetrics, busy: boolean): SolveOutcome {
  if (busy) return "running";
  if (!metrics.solveStatus) return "pending";
  if (metrics.hardConstraintsMet) return "solved";
  return metrics.solveStatus === "timeout" ? "timeout" : "infeasible";
}

const FEASIBLE: SolveResult["status"][] = ["optimal", "feasible"];

/** Pure dashboard KPIs from the parsed problem + the last solve. Honest by
    design: hard-constraint satisfaction is a boolean (not a fake percent), and
    the headline number is the real solver quality score. */
export function dashboardMetrics(
  entities: ProblemEntities | null,
  result: SolveResult | null,
): DashboardMetrics {
  const subjects = entities?.subjects ?? [];
  const counts = {
    courses: subjects.length,
    instructors: entities?.teachers.length ?? 0,
    rooms: entities?.rooms.length ?? 0,
    groups: entities?.groups.length ?? 0,
  };
  const total = counts.courses + counts.instructors + counts.rooms + counts.groups;
  return {
    ...counts,
    weeklyHours: subjects.reduce((sum, subject) => sum + subject.hoursPerWeek, 0),
    hasData: total > 0,
    solveStatus: result?.status ?? null,
    qualityScore: result?.quality_score ?? null,
    hardConstraintsMet: result ? FEASIBLE.includes(result.status) : null,
  };
}
