import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { parseEntities } from "./entities";
import { countScheduled } from "./grid";
import type { ProblemDoc } from "./problem-doc";
import { solverClient, type SolveResult } from "./solver-client";
import { useProblemDoc } from "./use-problem-doc";
import { useSolveState } from "./use-solve-state";
import { loadPreferences } from "./use-preferences";
import { isTauri, useProblemFile } from "./use-problem-file";
import { useEntityEditing } from "./use-entity-editing";
import { useEntityNames } from "./use-entity-names";
import { useEditSession } from "./use-edit-session";
import { saveWarnings } from "./save-warnings";

/** Is there user work the first-run template bootstrap must not clobber? A parsed
 *  doc OR a non-empty (possibly malformed) yamlText draft both count - the latter
 *  is doc === null yet savable, so checking doc alone would let the background
 *  load overwrite a draft the user opened or typed. Mirrors the canSave signal. */
export function hasWorkspaceContent(doc: ProblemDoc | null, yamlText: string): boolean {
  return doc !== null || yamlText.trim().length > 0;
}

/** The whole keep-the-model layer the pre-router shell used to assemble, lifted into one
    hook so every route reads the same document, solve state, and derived
    facts through a context instead of prop-drilling from a single window.
    Routing is deliberately absent (this runs outside the router); navigation
    side effects live in the shell. */
export function useWorkspaceDoc() {
  const { yamlText, doc, parseError, regenerated, editYaml, applyDocEdit } = useProblemDoc();
  // Live handles on the current doc AND raw text so an async guard (the first-run
  // template load) re-checks them at write time rather than trusting the stale
  // values its closure captured. Both matter: a malformed-YAML draft keeps
  // doc === null while yamlText stays non-empty (see hasWorkspaceContent).
  const docRef = useRef(doc);
  const yamlTextRef = useRef(yamlText);
  useEffect(() => {
    docRef.current = doc;
    yamlTextRef.current = yamlText;
  }, [doc, yamlText]);
  // Notify on solve completion when the user enabled it (Toaster lives in the shell).
  const notifyOnSolved = (solved: SolveResult) => {
    if (!loadPreferences().notifyOnComplete) return;
    if (solved.status === "optimal" || solved.status === "feasible") {
      toast.success(`Timetable ready (${solved.status})`);
    } else {
      toast.warning(`No timetable found (${solved.status})`);
    }
  };
  const solveState = useSolveState(doc, notifyOnSolved);
  const [templateError, setTemplateError] = useState<string | null>(null);
  // Shared "start a new problem" intent so any surface (Dashboard button,
  // command palette) opens the one confirm the shell renders.
  const [pendingNewProblem, setPendingNewProblem] = useState(false);

  // Two write channels mirror the pre-router shell: a problem edit invalidates the shown
  // schedule, while pin/unpin (applyDocEdit) records slots from it and keeps it.
  const editProblem = (next: ProblemDoc) => {
    applyDocEdit(next);
    solveState.invalidate();
  };
  const writeYaml = (text: string) => {
    editYaml(text);
    solveState.invalidate();
  };

  const editing = useEntityEditing(doc, editProblem, applyDocEdit);
  const file = useProblemFile(yamlText, writeYaml);

  // Shared template fetch. onlyWhenEmpty guards the first-run background load so
  // a slow sidecar response can't clobber a problem the user started (or
  // opened/imported) after dismissing the welcome card; the docRef re-check runs
  // at write time, not against the stale value the closure captured.
  const writeTemplate = async (onlyWhenEmpty: boolean) => {
    setTemplateError(null);
    try {
      const text = await solverClient.template();
      if (onlyWhenEmpty && hasWorkspaceContent(docRef.current, yamlTextRef.current)) return;
      writeYaml(text);
    } catch (problem) {
      const detail = problem instanceof Error ? problem.message : String(problem);
      setTemplateError(`Template load failed: ${detail}`);
    }
  };
  // Explicit "Load Template" callers always overwrite (stay handler-safe: no
  // args, so React event handlers can pass them directly). The first-run
  // background load uses the guarded variant.
  const loadTemplate = () => writeTemplate(false);
  const loadTemplateIfEmpty = () => writeTemplate(true);

  // Clear everything back to the blank get-started state (doc -> null), so a
  // user can start a fresh run with different inputs. writeYaml("") also
  // invalidates any shown solve result.
  const newProblem = () => {
    setTemplateError(null);
    setPendingNewProblem(false);
    writeYaml("");
  };
  // Open the discard confirm (no-op when there is nothing to clear).
  const requestNewProblem = () => doc && setPendingNewProblem(true);
  const cancelNewProblem = () => setPendingNewProblem(false);

  const entities = useMemo(() => (doc ? parseEntities(doc) : null), [doc]);
  const schedule = useMemo(() => solveState.result?.schedule ?? [], [solveState.result]);
  const scheduledCounts = useMemo(
    () => (solveState.result ? countScheduled(solveState.result.schedule) : null),
    [solveState.result],
  );
  // The M8 manual-edit session (moves, room changes, conflicts, /score
  // re-pricing, locks, reset) lives in its own hook since M8c.
  const session = useEditSession(doc, schedule, entities, {
    applyDocEdit,
    pin: editing.pin,
    unpin: editing.unpin,
  });
  const { subjectNames, roomNames } = useEntityNames(entities);

  // Saving with unapplied session edits writes a problem that will re-solve
  // away from what the screen shows - warn, then save anyway (never block).
  // Unplaced sessions warn on their own count: they produce no pin, so the
  // pin count alone would stay silent while the edit really does vanish.
  const saveFile = () => {
    for (const warning of saveWarnings(session.unappliedCount, session.manual.unplaced.length)) {
      toast.warning(warning);
    }
    return file.saveFile();
  };

  // Each solve reads the latest saved time limit (Settings persists it).
  const solve = () => solveState.solve(loadPreferences().timeLimit);

  // Re-run keeping every edit and lock: fold session edits into pins, then
  // solve the JUST-written doc - solve's explicit-problem param dodges the
  // stale closure (applyDocEdit is a state write this tick cannot observe).
  const reSolve = () => {
    const next = session.applyForReSolve();
    if (next) solveState.solve(loadPreferences().timeLimit, next);
  };

  return {
    yamlText,
    doc,
    parseError,
    regenerated,
    entities,
    editProblem,
    writeYaml,
    applyDocEdit,
    loadTemplate,
    loadTemplateIfEmpty,
    newProblem,
    requestNewProblem,
    cancelNewProblem,
    pendingNewProblem,
    templateError,
    isTauri: isTauri(),
    fileError: file.fileError,
    openFile: file.openFile,
    saveFile,
    result: solveState.result,
    selected: solveState.selected,
    polish: solveState.polish,
    setPolish: solveState.setPolish,
    setSelected: solveState.setSelected,
    busy: solveState.busy,
    solveError: solveState.solveError,
    progress: solveState.progress,
    lastObjective: solveState.lastObjective,
    solve,
    reSolve,
    cancel: solveState.cancel,
    invalidate: solveState.invalidate,
    schedule,
    scheduledCounts,
    subjectNames,
    roomNames,
    editing,
    ...session,
  };
}

export type WorkspaceDoc = ReturnType<typeof useWorkspaceDoc>;
