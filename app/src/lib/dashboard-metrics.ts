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
      constraints there), false when infeasible, null before any solve. */
  hardConstraintsMet: boolean | null;
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
