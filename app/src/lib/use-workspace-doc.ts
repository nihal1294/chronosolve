import { useMemo, useState } from "react";
import { parseEntities } from "./entities";
import { countScheduled } from "./grid";
import type { ProblemDoc } from "./problem-doc";
import { solverClient } from "./solver-client";
import { useProblemDoc } from "./use-problem-doc";
import { useSolveState } from "./use-solve-state";
import { isTauri, useProblemFile } from "./use-problem-file";
import { useEntityEditing } from "./use-entity-editing";
import { useEntityNames } from "./use-entity-names";
import { useTimelineLocks } from "./use-timeline-locks";

/** The whole keep-the-model layer the pre-router shell used to assemble, lifted into one
    hook so every route reads the same document, solve state, and derived
    facts through a context instead of prop-drilling from a single window.
    Routing is deliberately absent (this runs outside the router); navigation
    side effects live in the shell. */
export function useWorkspaceDoc() {
  const { yamlText, doc, parseError, regenerated, editYaml, applyDocEdit } = useProblemDoc();
  const solveState = useSolveState(doc, () => {});
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

  const loadTemplate = async () => {
    setTemplateError(null);
    try {
      writeYaml(await solverClient.template());
    } catch (problem) {
      const detail = problem instanceof Error ? problem.message : String(problem);
      setTemplateError(`Template load failed: ${detail}`);
    }
  };

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
  const locks = useTimelineLocks(entities, schedule, editing.pin, editing.unpin);
  const { subjectNames, roomNames } = useEntityNames(entities);

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
    newProblem,
    requestNewProblem,
    cancelNewProblem,
    pendingNewProblem,
    templateError,
    isTauri: isTauri(),
    fileError: file.fileError,
    openFile: file.openFile,
    saveFile: file.saveFile,
    result: solveState.result,
    selected: solveState.selected,
    setSelected: solveState.setSelected,
    busy: solveState.busy,
    solveError: solveState.solveError,
    progress: solveState.progress,
    lastObjective: solveState.lastObjective,
    solve: solveState.solve,
    cancel: solveState.cancel,
    invalidate: solveState.invalidate,
    schedule,
    scheduledCounts,
    subjectNames,
    roomNames,
    editing,
    locks,
  };
}

export type WorkspaceDoc = ReturnType<typeof useWorkspaceDoc>;
