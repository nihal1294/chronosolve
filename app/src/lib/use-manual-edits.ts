import { useMemo, useState } from "react";
import { applyOverrides, type ManualOverride } from "./overrides";
import { buildConflictInputs } from "./conflict-model";
import { findConflicts, type Conflict } from "./conflicts";
import { blockAnchor, scheduleKey } from "./grid";
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

/** A raw pre_assignments entry's schedule key, or null when it is not one. */
const pinKey = (value: unknown): string | null => {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.subject_id !== "string") return null;
  if (typeof entry.day !== "string" || typeof entry.slot !== "number") return null;
  return scheduleKey(entry.subject_id, entry.day, entry.slot);
};

/** The doc minus pins that match no schedule slot - what a reverted edit
    session leaves behind after pin-after-move (invisible on the grid, yet
    re-applying the move as a hard pre-assignment on the next solve). A pin
    whose slot IS occupied in the base - even by another occurrence of the
    same subject - deliberately stays: pins are occurrence-agnostic
    subject|day|slot booleans, and such a pin renders as a visible pinned
    block after reset (one click from unpin), unlike the dangling case.
    Returns the SAME doc when nothing dangles so callers can skip a no-op
    doc write; an empty schedule prunes nothing (there is no result to
    compare against); malformed entries always survive (doc round-trip). */
export function withoutDanglingPins(doc: ProblemDoc, schedule: ScheduleEntry[]): ProblemDoc {
  const list = Array.isArray(doc.pre_assignments) ? (doc.pre_assignments as unknown[]) : [];
  if (list.length === 0 || schedule.length === 0) return doc;
  const placed = new Set(schedule.map((s) => scheduleKey(s.subject_id, s.day, s.slot)));
  const kept = list.filter((entry) => {
    const key = pinKey(entry);
    return key === null || placed.has(key);
  });
  return kept.length === list.length ? doc : { ...doc, pre_assignments: kept };
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
