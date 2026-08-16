import { useMemo, useState } from "react";
import { buildConflictInputs } from "./conflict-model";
import {
  activeHistory,
  canRedo,
  canUndo,
  docPinAt,
  invertAction,
  pushAction,
  redoStep,
  replayAction,
  undoStep,
  type EditAction,
  type HistoryExec,
  type HistoryState,
} from "./edit-history";
import { hasUnappliedEdits, pinDiff, planApplyDoc, unappliedPinCount } from "./apply-edits";
import { recordingEdits } from "./recording-verbs";
import type { ProblemDoc } from "./problem-doc";
import type { ProblemEntities } from "./entities";
import { eligibleRooms, type RoomOption } from "./room-eligibility";
import type { ScheduleEntry } from "./solver-client";
import { subjectBlockSizes, useTimelineLocks } from "./use-timeline-locks";
import { useManualEdits, withoutDanglingPins } from "./use-manual-edits";
import { useEditedQuality } from "./use-edited-quality";

/** Doc-write callbacks the session layer composes over (grouped so the hook
    stays within the parameter limit). */
export interface EditSessionIO {
  applyDocEdit: (doc: ProblemDoc) => void;
  pin: (entry: ScheduleEntry) => void;
  unpin: (entry: ScheduleEntry) => void;
}

/** The whole M8 manual-edit session over the current solve result: moves and
    room changes applied to the shown schedule, the live conflict mirror,
    debounced /score re-pricing, locks reading the EDITED schedule (pinning a
    moved session persists its new slot), Apply-to-doc, linear undo/redo over
    all of it, and the full-revert reset. Extracted from use-workspace-doc
    (M8c) so the workspace stays a thin composition; its return keys feed the
    workspace's own return unchanged. */
export function useEditSession(
  doc: ProblemDoc | null,
  schedule: ScheduleEntry[],
  entities: ProblemEntities | null,
  io: EditSessionIO,
) {
  const blockSizes = useMemo(() => subjectBlockSizes(entities), [entities]);
  const edits = useManualEdits(doc, schedule, blockSizes);

  // Undo/redo history, base-scoped like MoveState: a new solve (or an
  // invalidation emptying the schedule after editProblem/writeYaml) derives
  // it to empty, so only reset clears it explicitly. Doc-only writes (locks,
  // apply, undo itself) keep the schedule identity, so history survives them.
  const [histState, setHistState] = useState<HistoryState | null>(null);
  const history = activeHistory(histState, schedule);
  const record = (action: EditAction) =>
    setHistState({ base: schedule, history: pushAction(history, action) });

  const manual = recordingEdits(edits, record);

  // Locks resolve the block anchor, then these wrappers capture the action -
  // and, before an unpin deletes it, the pin's room - ahead of the doc write.
  const recordingPin = (entry: ScheduleEntry) => {
    if (docPinAt(doc, entry) === null) {
      record({
        kind: "lock",
        pin: { subjectId: entry.subject_id, day: entry.day, slot: entry.slot },
        wasLocked: false,
      });
    }
    io.pin(entry);
  };
  const recordingUnpin = (entry: ScheduleEntry) => {
    const prior = docPinAt(doc, entry);
    if (prior) record({ kind: "lock", pin: prior, wasLocked: true });
    io.unpin(entry);
  };

  const editedQuality = useEditedQuality(doc, edits.displaySchedule, edits.overrides.length > 0);
  const locks = useTimelineLocks(entities, edits.displaySchedule, blockSizes, recordingPin, recordingUnpin);

  // Reset must also revert the pins the edit session wrote at moved slots -
  // left behind they match no shown block (invisible) yet re-apply the move
  // as a hard pre-assignment on the next solve. Pins at unmoved slots stay.
  const resetManualEdits = () => {
    if (doc) {
      const pruned = withoutDanglingPins(doc, schedule);
      if (pruned !== doc) io.applyDocEdit(pruned);
    }
    edits.resetEdits();
    setHistState(null);
  };

  // Room picker model + verb; changeRoom routes through the recording verb.
  const conflictInputs = useMemo(() => (doc ? buildConflictInputs(doc) : null), [doc]);
  const roomOptionsFor = (entry: ScheduleEntry): RoomOption[] =>
    conflictInputs ? eligibleRooms(conflictInputs, entry.subject_id) : [];
  const changeRoom = (entry: ScheduleEntry, roomId: string) => manual.roomSession(entry, roomId);

  // Apply edits: write every session pin into the doc so save and re-solve
  // honor the edited timetable. Overrides stay - the grid keeps showing the
  // session; only the missing pins gate the button and the doc write.
  const unappliedCount = useMemo(
    () => (doc ? unappliedPinCount(doc, edits.overrides) : 0),
    [doc, edits.overrides],
  );
  // The Apply GATE is separate from that badge count: an unplace writes no pin
  // but does remove one, so the count can sit at 0 with a doc change pending.
  const canApply = useMemo(
    () => (doc ? hasUnappliedEdits(doc, edits.overrides) : false),
    [doc, edits.overrides],
  );
  // Both write paths share the doc-aware plan: stale pins (a move left the
  // slot) come OFF before the destination pins go on, so a moved doc pin is
  // relocated - never doubled into an unsolvable two-slot requirement.
  const planApply = () => planApplyDoc(doc as ProblemDoc, edits.overrides);
  const reapply = () => {
    if (!doc) return;
    const { next } = planApply();
    if (next !== doc) io.applyDocEdit(next);
  };
  const applyEdits = () => {
    if (!doc) return;
    const { pins, stale, next } = planApply();
    if (next === doc) return;
    record({ kind: "apply", ...pinDiff(doc, pins), removed: stale });
    io.applyDocEdit(next);
  };
  // Re-run-with-locks half of the verb: same fold as Apply but WITHOUT a
  // history record - the solve this precedes invalidates the schedule, which
  // derives history to empty in the same tick. Returns the doc the solve
  // must read (the hook closures cannot observe this tick's doc write).
  const applyForReSolve = (): ProblemDoc | null => {
    if (!doc) return null;
    const { next } = planApply();
    if (next !== doc) io.applyDocEdit(next);
    return next;
  };

  // Every member wires to the RAW hook, never to `manual`: undo and redo move
  // the override log without recording new history.
  const exec: HistoryExec = {
    doc,
    popOverride: edits.popOverride,
    pushOverride: edits.pushOverride,
    removeUnplaceAt: edits.removeUnplaceAt,
    insertOverride: edits.insertOverride,
    applyDocEdit: io.applyDocEdit,
    reapply,
  };
  const undo = () => {
    const step = undoStep(history);
    if (!step) return;
    setHistState({ base: schedule, history: step.history });
    invertAction(step.action, exec);
  };
  const redo = () => {
    const step = redoStep(history);
    if (!step) return;
    setHistState({ base: schedule, history: step.history });
    replayAction(step.action, exec);
  };

  return {
    blockSizes,
    manual,
    editedQuality,
    locks,
    resetManualEdits,
    roomOptionsFor,
    changeRoom,
    unappliedCount,
    canApply,
    applyEdits,
    applyForReSolve,
    undo,
    redo,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
