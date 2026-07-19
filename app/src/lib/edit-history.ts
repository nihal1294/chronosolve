import type { ManualOverride } from "./overrides";
import { pinAssignment, unpinAssignment, type PinSlot, type ProblemDoc } from "./problem-doc";
import type { ScheduleEntry } from "./solver-client";

/** One undoable user action. Each variant carries everything its inverse AND
    its replay need at execution time: session kinds keep the exact override
    (undo drops the log tail, redo re-appends this payload - without it the
    popped entry is unrecoverable), lock keeps the pin as written (with the
    room it carried, so undoing an unpin restores it), apply keeps what it
    added, the PRIOR versions of pins it overwrote, and the doc pins it
    removed because a move had left them behind. */
export type EditAction =
  | { kind: "move"; override: ManualOverride }
  | { kind: "room"; override: ManualOverride }
  | { kind: "lock"; pin: PinSlot; wasLocked: boolean }
  | { kind: "apply"; added: PinSlot[]; replaced: PinSlot[]; removed: PinSlot[] };

export interface EditHistory {
  done: EditAction[];
  undone: EditAction[];
}

export const EMPTY_HISTORY: EditHistory = { done: [], undone: [] };

/** Record a new action: appends to done and CLEARS undone - a fresh action
    invalidates the undone future (standard linear history). */
export function pushAction(history: EditHistory, action: EditAction): EditHistory {
  return { done: [...history.done, action], undone: [] };
}

/** Step back: move the done tail to undone and hand back the action to
    invert. Null when there is nothing to undo. */
export function undoStep(history: EditHistory): { history: EditHistory; action: EditAction } | null {
  const action = history.done[history.done.length - 1];
  if (action === undefined) return null;
  return { history: { done: history.done.slice(0, -1), undone: [...history.undone, action] }, action };
}

/** Step forward again: move the undone tail back to done, returning the
    action to replay with its recorded payload intact. */
export function redoStep(history: EditHistory): { history: EditHistory; action: EditAction } | null {
  const action = history.undone[history.undone.length - 1];
  if (action === undefined) return null;
  return { history: { done: [...history.done, action], undone: history.undone.slice(0, -1) }, action };
}

export const canUndo = (history: EditHistory): boolean => history.done.length > 0;
export const canRedo = (history: EditHistory): boolean => history.undone.length > 0;

/** History recorded against one specific base schedule (the MoveState
    pattern): a new solve - or an invalidation emptying the schedule after
    editProblem/writeYaml - changes the base identity, so the active history
    DERIVES to empty instead of needing effect cleanup. */
export interface HistoryState {
  base: ScheduleEntry[];
  history: EditHistory;
}

export function activeHistory(state: HistoryState | null, schedule: ScheduleEntry[]): EditHistory {
  return state && state.base === schedule ? state.history : EMPTY_HISTORY;
}

/** The doc's pin at `entry`'s slot triple, with the room it carries - what an
    unpin is about to delete, captured beforehand so undo can restore it. */
export function docPinAt(doc: ProblemDoc | null, entry: ScheduleEntry): PinSlot | null {
  const list =
    doc && Array.isArray(doc.pre_assignments) ? (doc.pre_assignments as Record<string, unknown>[]) : [];
  const found = list.find(
    (e) => e.subject_id === entry.subject_id && e.day === entry.day && e.slot === entry.slot,
  );
  if (!found) return null;
  const pin: PinSlot = { subjectId: entry.subject_id, day: entry.day, slot: entry.slot };
  return typeof found.room_id === "string" ? { ...pin, roomId: found.room_id } : pin;
}

/** What the executors need from the edit session (grouped for the parameter
    limit). `reapply` recomputes Apply from the live overrides - LIFO
    discipline guarantees the doc is back in its pre-apply state whenever an
    apply action replays, so recomputing reproduces the recorded transition. */
export interface HistoryExec {
  doc: ProblemDoc | null;
  popOverride: () => void;
  pushOverride: (override: ManualOverride) => void;
  applyDocEdit: (next: ProblemDoc) => void;
  reapply: () => void;
}

/** Run `action`'s inverse. Session kinds only touch the override log (a push
    happens iff an append happened, so the two tails stay aligned); lock and
    apply invert at the DOC level, because io-level pin/unpin take a schedule
    entry and would drop the restored room. */
export function invertAction(action: EditAction, exec: HistoryExec): void {
  if (action.kind === "move" || action.kind === "room") return exec.popOverride();
  if (!exec.doc) return;
  if (action.kind === "lock") {
    return exec.applyDocEdit(
      action.wasLocked ? pinAssignment(exec.doc, action.pin) : unpinAssignment(exec.doc, action.pin),
    );
  }
  let next = exec.doc;
  for (const pin of action.added) next = unpinAssignment(next, pin);
  // Remove-then-re-pin: a bare upsert cannot strip a room back OFF, so a
  // roomless prior is restored by deleting the roomful pin first.
  for (const prior of action.replaced) next = pinAssignment(unpinAssignment(next, prior), prior);
  for (const pin of action.removed) next = pinAssignment(next, pin);
  exec.applyDocEdit(next);
}

/** Replay `action` after an undo (the redo executor). */
export function replayAction(action: EditAction, exec: HistoryExec): void {
  if (action.kind === "move" || action.kind === "room") return exec.pushOverride(action.override);
  // reapply() recomputes from live overrides instead of replaying the stored
  // added/replaced pins. Sound ONLY because history is strictly LIFO: an apply
  // can be redone solely when every action recorded after it has been undone
  // first, so the doc and override log are back in their pre-apply state.
  if (action.kind === "apply") return exec.reapply();
  if (!exec.doc) return;
  exec.applyDocEdit(
    action.wasLocked ? unpinAssignment(exec.doc, action.pin) : pinAssignment(exec.doc, action.pin),
  );
}
