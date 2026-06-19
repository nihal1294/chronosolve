import { useRef, useState } from "react";
import { solverClient, type ScheduleEntry, type SolveProgress, type SolveResult } from "./solver-client";
import type { ProblemDoc } from "./problem-doc";

const isAbort = (problem: unknown): boolean =>
  problem instanceof DOMException && problem.name === "AbortError";

/** Solve lifecycle state plus the staleness rule: a displayed schedule only
    stays meaningful while the problem it was solved from is unchanged, so
    callers invalidate() on every problem edit. Solves stream SSE progress
    (one snapshot per improved solution); cancel() aborts mid-search. The
    previous solve's final objective survives invalidation so Analytics can
    show a delta against the last baseline. */
export function useSolveState(doc: ProblemDoc | null, onSolved: (result: SolveResult) => void) {
  const [result, setResult] = useState<SolveResult | null>(null);
  const [selected, setSelected] = useState<ScheduleEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SolveProgress | null>(null);
  const [lastObjective, setLastObjective] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const completedObjectiveRef = useRef<number | null>(null);

  const invalidate = () => {
    setResult(null);
    setSelected(null);
    setProgress(null);
  };

  const solve = async (timeLimit = 60) => {
    if (busy || doc === null) return; // button is disabled, but keep the invariant explicit
    setBusy(true);
    setSolveError(null);
    invalidate();
    const controller = new AbortController();
    controllerRef.current = controller;
    let finalObjective: number | null = null;
    try {
      const solved = await solverClient.solveStream(doc, timeLimit, {
        signal: controller.signal,
        onProgress: (snapshot) => {
          finalObjective = snapshot.objective;
          setProgress(snapshot);
        },
      });
      // Order is load-bearing: publish the *previous* solve's objective as the
      // baseline before overwriting the ref with this solve's final objective.
      setLastObjective(completedObjectiveRef.current);
      completedObjectiveRef.current = finalObjective;
      setResult(solved);
      onSolved(solved);
    } catch (problem) {
      if (!isAbort(problem)) setSolveError(String(problem));
      setProgress(null); // cancelled or failed - the snapshot describes nothing
    } finally {
      setBusy(false);
      controllerRef.current = null;
    }
  };

  const cancel = () => controllerRef.current?.abort();

  return {
    result,
    selected,
    setSelected,
    busy,
    solveError,
    progress,
    lastObjective,
    solve,
    cancel,
    invalidate,
  };
}
