import { useState } from "react";
import { solverClient, type ScheduleEntry, type SolveResult } from "./solver-client";
import type { ProblemDoc } from "./problem-doc";

/** Solve lifecycle state plus the staleness rule: a displayed schedule only
    stays meaningful while the problem it was solved from is unchanged, so
    callers invalidate() on every problem edit. The Inspector selection is a
    pointer into the result and always clears with it. */
export function useSolveState(doc: ProblemDoc | null, onSolved: (result: SolveResult) => void) {
  const [result, setResult] = useState<SolveResult | null>(null);
  const [selected, setSelected] = useState<ScheduleEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);

  const invalidate = () => {
    setResult(null);
    setSelected(null);
  };

  const solve = async () => {
    if (busy || doc === null) return; // button is disabled, but keep the invariant explicit
    setBusy(true);
    setSolveError(null);
    invalidate();
    try {
      const solved = await solverClient.solve(doc);
      setResult(solved);
      onSolved(solved);
    } catch (problem) {
      setSolveError(String(problem));
    } finally {
      setBusy(false);
    }
  };

  return { result, selected, setSelected, busy, solveError, solve, invalidate };
}
