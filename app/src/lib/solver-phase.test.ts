import { describe, expect, it } from "vitest";
import { deriveSolverPhase } from "./solver-phase";
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
