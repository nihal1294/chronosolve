import { describe, expect, test } from "vitest";
import { dashboardMetrics, solveOutcome } from "./dashboard-metrics";
import type { ProblemEntities } from "./entities";
import type { SolveResult } from "./solver-client";

const entities: ProblemEntities = {
  subjects: [
    {
      id: "m",
      name: "Math",
      hoursPerWeek: 4,
      teacherIds: ["t1"],
      groupIds: ["g1"],
      kind: "theory",
      consecutiveHours: 1,
    },
    {
      id: "p",
      name: "Physics",
      hoursPerWeek: 3,
      teacherIds: ["t2"],
      groupIds: ["g1"],
      kind: "lab",
      consecutiveHours: 2,
    },
  ],
  teachers: [
    { id: "t1", name: "A", unavailable: "" },
    { id: "t2", name: "B", unavailable: "" },
  ],
  groups: [{ id: "g1", name: "CSE-3", size: 60, department: "CSE", semester: "3" }],
  rooms: [
    { id: "r1", name: "R1", capacity: 70, type: "any" },
    { id: "r2", name: "Lab1", capacity: 30, type: "lab" },
  ],
  preAssignments: [],
  days: ["Mon", "Tue"],
  slotsPerDay: 6,
  slotLabels: {},
};

const result = (status: SolveResult["status"], quality: number | null): SolveResult => ({
  status,
  schedule: [],
  quality_score: quality,
  solve_time_seconds: 1.2,
  unresolved: [],
  conflicts: [],
});

describe("dashboardMetrics", () => {
  test("derives entity counts and total weekly hours from the parsed problem", () => {
    const m = dashboardMetrics(entities, null);
    expect(m.courses).toBe(2);
    expect(m.instructors).toBe(2);
    expect(m.rooms).toBe(2);
    expect(m.groups).toBe(1);
    expect(m.weeklyHours).toBe(7); // 4 + 3
    expect(m.hasData).toBe(true);
  });

  test("an absent document reports zero data and no solve", () => {
    const m = dashboardMetrics(null, null);
    expect(m.courses).toBe(0);
    expect(m.hasData).toBe(false);
    expect(m.solveStatus).toBeNull();
    expect(m.qualityScore).toBeNull();
    expect(m.hardConstraintsMet).toBeNull();
  });

  test("a feasible solve means hard constraints are met and exposes the real quality score", () => {
    const m = dashboardMetrics(entities, result("optimal", 96));
    expect(m.solveStatus).toBe("optimal");
    expect(m.qualityScore).toBe(96);
    expect(m.hardConstraintsMet).toBe(true);
  });

  test("an infeasible solve means hard constraints are NOT met", () => {
    const m = dashboardMetrics(entities, result("infeasible", null));
    expect(m.hardConstraintsMet).toBe(false);
    expect(m.qualityScore).toBeNull();
  });
});

describe("solveOutcome", () => {
  const at = (status: SolveResult["status"]) => dashboardMetrics(entities, result(status, null));

  test("a timeout stays distinct from infeasible (rerun, don't 'fix your data')", () => {
    // Regression guard for the Codex P2: both have an empty schedule and
    // hardConstraintsMet === false, but only infeasible should read as failed.
    expect(solveOutcome(at("timeout"), false)).toBe("timeout");
    expect(solveOutcome(at("infeasible"), false)).toBe("infeasible");
  });

  test("optimal/feasible are solved; no solve is pending; busy is running", () => {
    expect(solveOutcome(at("optimal"), false)).toBe("solved");
    expect(solveOutcome(at("feasible"), false)).toBe("solved");
    expect(solveOutcome(dashboardMetrics(entities, null), false)).toBe("pending");
    expect(solveOutcome(dashboardMetrics(entities, null), true)).toBe("running");
  });
});
