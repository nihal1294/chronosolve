import { useMemo, useState } from "react";
import { applyOverrides, type ManualOverride } from "./overrides";
import {
  appendUnplace,
  canPutBack,
  insertOverrideAt,
  removeUnplaceAt as removeAt,
  unplacedList,
  type UnplacedItem,
} from "./unplace";
import { buildConflictInputs } from "./conflict-model";
import { findConflicts, type Conflict } from "./conflicts";
import { blockAnchor } from "./grid";
import type { ProblemDoc } from "./problem-doc";
import type { ScheduleEntry } from "./solver-client";

/** Manual moves recorded against one specific base schedule. Keeping the base
    alongside the moves makes "a new solve discards edits" a pure derivation
    (activeMoves) instead of effect bookkeeping. */
export interface MoveState {
  base: ScheduleEntry[];
  moves: ManualOverride[];
}

/** The moves that still apply: edits belong to the schedule they were made on. */
export function activeMoves(state: MoveState | null, schedule: ScheduleEntry[]): ManualOverride[] {
  return state && state.base === schedule ? state.moves : [];
}

/** The move list after dragging `entry`'s block to `to` (anchor semantics,
    matching pre_assignments). Dropping a block onto its own anchor is a no-op. */
export function appendMove(
  moves: ManualOverride[],
  displaySchedule: ScheduleEntry[],
  entry: ScheduleEntry,
  to: { day: string; slot: number },
  blockSizes: ReadonlyMap<string, number>,
): ManualOverride[] {
  const anchor = blockAnchor(displaySchedule, entry, blockSizes);
  if (anchor.day === to.day && anchor.slot === to.slot) return moves;
  return [
    ...moves,
    { kind: "move", subjectId: entry.subject_id, from: { day: anchor.day, slot: anchor.slot }, to },
  ];
}

/** The override list after changing `entry`'s block to `roomId` (anchor
    semantics, matching appendMove). Re-picking the room the entry already
    shows is a no-op with identity return, so history (M8c undo) never
    records a no-change verb. */
export function appendRoom(
  overrides: ManualOverride[],
  displaySchedule: ScheduleEntry[],
  entry: ScheduleEntry,
  roomId: string,
  blockSizes: ReadonlyMap<string, number>,
): ManualOverride[] {
  if (entry.room_id === roomId) return overrides;
  const anchor = blockAnchor(displaySchedule, entry, blockSizes);
  return [
    ...overrides,
    { kind: "room", subjectId: entry.subject_id, at: { day: anchor.day, slot: anchor.slot }, roomId },
  ];
}

/** The selection, kept only while its exact entry is still rendered. Moves,
    resets, and new solves replace the objects they touch (applyOverrides keeps
    untouched entries by identity), so a stale panel target derives to null
    instead of describing - or pinning - a slot the block no longer occupies. */
export function displayedSelection(
  displaySchedule: ScheduleEntry[],
  selected: ScheduleEntry | null,
): ScheduleEntry | null {
  return selected !== null && displaySchedule.includes(selected) ? selected : null;
}

export interface ManualEdits {
  overrides: ManualOverride[];
  /** Base schedule with every override applied - what the Timetable renders. */
  displaySchedule: ScheduleEntry[];
  conflicts: Conflict[];
  /** "subject|day|slot" keys of every conflicted entry (block styling). */
  conflictKeys: Set<string>;
  /** Move the block covering `entry` so its anchor lands on (day, slot).
      Returns the recorded override - or null when the drop was a no-op, the
      seam edit history (M8c) keys its pushes on. */
  moveSession: (entry: ScheduleEntry, to: { day: string; slot: number }) => ManualOverride | null;
  /** Reassign the room for the block covering `entry` (session-level).
      Same return contract as moveSession. */
  roomSession: (entry: ScheduleEntry, roomId: string) => ManualOverride | null;
  /** Take the block covering `entry` off the grid. Same return contract as
      moveSession; null also when the session is PINNED (unpin first).
      `lockedKeys` is passed in rather than read from a lock hook: locks are
      derived FROM displaySchedule, so this hook cannot depend on them. */
  unplaceSession: (entry: ScheduleEntry, lockedKeys: ReadonlySet<string>) => ManualOverride | null;
  /** Put back: drop the unplace at `index`, returning it so history can record
      the index it needs to re-insert at. Null when that index holds no
      unplace, or when returning the session would stack it on another
      occurrence of the same subject (the row is disabled for that case). */
  removeUnplaceAt: (index: number) => ManualOverride | null;
  /** What is currently off the grid (the ConflictStrip tray). */
  unplaced: UnplacedItem[];
  /** Undo/redo primitives: drop / re-append the override log tail verbatim,
      and - for Put back alone - re-insert at a given position. */
  popOverride: () => void;
  pushOverride: (override: ManualOverride) => void;
  insertOverride: (override: ManualOverride, index: number) => void;
  resetEdits: () => void;
}

/** The manual-edit layer over the current solve result (M8 design, mode A):
    moves apply instantly to the shown schedule, and the M8a conflict mirror
    flags what they break. The base schedule's identity scopes the edits, so a
    fresh solve starts clean. */
export function useManualEdits(
  doc: ProblemDoc | null,
  schedule: ScheduleEntry[],
  blockSizes: ReadonlyMap<string, number>,
): ManualEdits {
  const [state, setState] = useState<MoveState | null>(null);
  const overrides = activeMoves(state, schedule);

  const displaySchedule = useMemo(
    () => applyOverrides(schedule, overrides, blockSizes),
    [schedule, overrides, blockSizes],
  );
  const conflicts = useMemo(
    () => (doc ? findConflicts(buildConflictInputs(doc), displaySchedule) : []),
    [doc, displaySchedule],
  );
  const conflictKeys = useMemo(() => new Set(conflicts.flatMap((c) => c.entryKeys)), [conflicts]);
  const unplaced = useMemo(
    () => unplacedList(overrides, schedule, blockSizes),
    [overrides, schedule, blockSizes],
  );

  // Verbs hand back what they appended (null = no-op identity return from
  // the pure append) so callers push history only for real changes.
  const record = (moves: ManualOverride[]): ManualOverride | null => {
    if (moves === overrides) return null;
    setState({ base: schedule, moves });
    return moves[moves.length - 1] as ManualOverride;
  };
  const moveSession = (entry: ScheduleEntry, to: { day: string; slot: number }) =>
    record(appendMove(overrides, displaySchedule, entry, to, blockSizes));
  const roomSession = (entry: ScheduleEntry, roomId: string) =>
    record(appendRoom(overrides, displaySchedule, entry, roomId, blockSizes));
  const unplaceSession = (entry: ScheduleEntry, lockedKeys: ReadonlySet<string>) =>
    record(appendUnplace(overrides, displaySchedule, entry, blockSizes, lockedKeys));
  // Put back does NOT go through `record`: that helper reports the log TAIL as
  // what changed, and this removes from the middle.
  const removeUnplaceAt = (index: number) => {
    // Guarded here as well as disabled in the tray: the verb is the invariant's
    // enforcement point, the disabled row is only the affordance.
    if (!canPutBack(overrides, index, schedule, blockSizes)) return null;
    const step = removeAt(overrides, index);
    if (!step) return null;
    setState({ base: schedule, moves: step.next });
    return step.removed;
  };

  return {
    overrides,
    displaySchedule,
    conflicts,
    conflictKeys,
    unplaced,
    moveSession,
    roomSession,
    unplaceSession,
    removeUnplaceAt,
    popOverride: () => setState({ base: schedule, moves: overrides.slice(0, -1) }),
    pushOverride: (override) => setState({ base: schedule, moves: [...overrides, override] }),
    insertOverride: (override, index) =>
      setState({ base: schedule, moves: insertOverrideAt(overrides, override, index) }),
    resetEdits: () => setState(null),
  };
}
