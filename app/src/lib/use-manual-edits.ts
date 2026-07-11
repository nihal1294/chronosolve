import { useMemo, useState } from "react";
import { applyOverrides, type ManualOverride } from "./overrides";
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

export interface ManualEdits {
  overrides: ManualOverride[];
  /** Base schedule with every override applied - what the Timetable renders. */
  displaySchedule: ScheduleEntry[];
  conflicts: Conflict[];
  /** "subject|day|slot" keys of every conflicted entry (block styling). */
  conflictKeys: Set<string>;
  /** Move the block covering `entry` so its anchor lands on (day, slot). */
  moveSession: (entry: ScheduleEntry, to: { day: string; slot: number }) => void;
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

  const moveSession = (entry: ScheduleEntry, to: { day: string; slot: number }) =>
    setState({ base: schedule, moves: appendMove(overrides, displaySchedule, entry, to, blockSizes) });

  return {
    overrides,
    displaySchedule,
    conflicts,
    conflictKeys,
    moveSession,
    resetEdits: () => setState(null),
  };
}
