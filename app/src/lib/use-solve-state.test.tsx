import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { solverClient, type SolveResult } from "./solver-client";
import { useSolveState } from "./use-solve-state";
import type { ProblemDoc } from "./problem-doc";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RESULT = {
  status: "optimal",
  schedule: [],
  solve_time_seconds: 0,
  unresolved: [],
  conflicts: [],
} as unknown as SolveResult;

/** Mount the hook against a fixed doc and hand back its live api. */
function harness(doc: ProblemDoc) {
  let api: ReturnType<typeof useSolveState> | null = null;
  function Probe() {
    api = useSolveState(doc, () => {});
    return null;
  }
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  return () => api as NonNullable<typeof api>;
}

afterEach(() => vi.restoreAllMocks());

describe("useSolveState.solve", () => {
  it("submits an explicitly passed doc - a caller that just wrote the doc in this tick must not solve the hook's stale closure value", async () => {
    const spy = vi.spyOn(solverClient, "solveStream").mockResolvedValue(RESULT);
    const stale = { subjects: [] } as unknown as ProblemDoc;
    const fresh = { subjects: [], pre_assignments: [{}] } as unknown as ProblemDoc;
    const api = harness(stale);
    await act(() => api().solve(1, fresh));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe(fresh);
  });

  it("defaults to the hook's doc when no override is passed", async () => {
    const spy = vi.spyOn(solverClient, "solveStream").mockResolvedValue(RESULT);
    const doc = { subjects: [] } as unknown as ProblemDoc;
    const api = harness(doc);
    await act(() => api().solve(1));
    expect(spy.mock.calls[0][0]).toBe(doc);
  });
});
