import { describe, expect, it } from "vitest";
import { busyMetrics, deriveSolverPhase } from "./solver-phase";
import type { SolveProgress, SolveResult } from "./solver-client";

const progress = (phase?: "solving" | "polishing"): SolveProgress => ({
  objective: 90,
  elapsed: 1,
  solution_count: 1,
  phase,
});

const result = { status: "feasible", schedule: [] } as unknown as SolveResult;

describe("deriveSolverPhase (M7.5 polishing sub-state)", () => {
  it("error wins over everything", () => {
    expect(deriveSolverPhase("boom", true, progress("polishing"), result)).toBe("error");
  });

  it("busy without a phase field stays 'solving' (older sidecar)", () => {
    expect(deriveSolverPhase(null, true, progress(), null)).toBe("solving");
  });

  it("busy with a polishing progress event shows 'polishing'", () => {
    expect(deriveSolverPhase(null, true, progress("polishing"), null)).toBe("polishing");
  });

  it("idle before anything happens; result status afterwards", () => {
    expect(deriveSolverPhase(null, false, null, null)).toBe("idle");
    expect(deriveSolverPhase(null, false, null, result)).toBe("feasible");
  });
});

describe("busyMetrics (PR #32: polish reports quality, not a CP-SAT objective)", () => {
  it("polishing labels the 0-100 quality score and the iteration", () => {
    expect(busyMetrics("polishing", { objective: 87.5, phase: "polishing", iteration: 240 })).toEqual([
      ["Best quality", "87.5 / 100"],
      ["Polish iteration", "240"],
    ]);
  });

  it("solving keeps the CP-SAT labels", () => {
    expect(busyMetrics("solving", { objective: 42, solution_count: 3 })).toEqual([
      ["Best objective", "42"],
      ["Solutions found", "3"],
    ]);
  });

  it("falls back to the previous run's objective before the first event", () => {
    expect(busyMetrics("solving", null, 42)).toEqual([
      ["Best objective", "42"],
      ["Solutions found", "0"],
    ]);
    expect(busyMetrics("solving", null)).toEqual([
      ["Best objective", "-"],
      ["Solutions found", "0"],
    ]);
  });
});
