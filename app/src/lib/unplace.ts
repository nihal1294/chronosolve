import { blockAnchor, hasStackedOccurrence, scheduleKey } from "./grid";
import { applyOverrides, type ManualOverride, type UnplaceOverride } from "./overrides";
import type { ScheduleEntry } from "./solver-client";

/** One row of the "Unplaced" tray: the override's POSITION in the log (what
    Put back removes - the same unplace can recur after an undo/redo cycle, so
    object identity is not a stable handle) plus where the occurrence sat when
    it left the grid, and whether it can go back at all. */
export interface UnplacedItem {
  index: number;
  subjectId: string;
  day: string;
  slot: number;
  /** True when the slot it left has since taken another occurrence of the same
      subject, so returning it would stack them (see canPutBack). */
  blocked: boolean;
}

/** The override list after taking `entry`'s block off the grid (anchor
    semantics, matching appendMove). A PINNED session is refused with a list
    identity return, mirroring sessionDragItem: its slot is a hard
    pre-assignment, and unplacing it would show a schedule the next solve
    contradicts. Unpin first. */
export function appendUnplace(
  overrides: ManualOverride[],
  displaySchedule: ScheduleEntry[],
  entry: ScheduleEntry,
  blockSizes: ReadonlyMap<string, number>,
  lockedKeys: ReadonlySet<string>,
): ManualOverride[] {
  if (lockedKeys.has(scheduleKey(entry.subject_id, entry.day, entry.slot))) return overrides;
  // (subject, day, slot) identifies the occurrence on its own: one subject
  // never holds a slot twice, so the anchor needs no tie-breaker and neither
  // does the pin plan that reads the same triple.
  const anchor = blockAnchor(displaySchedule, entry, blockSizes);
  return [
    ...overrides,
    { kind: "unplace", subjectId: entry.subject_id, at: { day: anchor.day, slot: anchor.slot } },
  ];
}

/** Put back: drop the override at `index`. This is the ONE non-tail edit the
    log takes - every other verb appends - so the caller must record the index
    alongside the removed override for undo to re-insert it in place. Null
    (rather than a silent no-op) when the index holds anything but an unplace,
    so history never records a step that changed nothing. */
export function removeUnplaceAt(
  overrides: ManualOverride[],
  index: number,
): { next: ManualOverride[]; removed: UnplaceOverride } | null {
  const removed = overrides[index];
  if (removed === undefined || removed.kind !== "unplace") return null;
  return { next: [...overrides.slice(0, index), ...overrides.slice(index + 1)], removed };
}

/** Undo a Put back: re-insert at the position it came from, restoring the
    exact log the replay ran on. */
export function insertOverrideAt(
  overrides: ManualOverride[],
  override: ManualOverride,
  index: number,
): ManualOverride[] {
  return [...overrides.slice(0, index), override, ...overrides.slice(index)];
}

/** Whether the unplace at `index` can be put back. Every other verb appends
    and undo pops the tail, so Put back is the ONLY edit that removes from the
    middle of the log - and therefore the only one that can seat a returning
    occurrence on top of one that moved into its slot behind it. Answered by
    replaying the log without that unplace rather than by inspecting the
    current display, so a move the removal re-activates is caught too. */
export function canPutBack(
  overrides: ManualOverride[],
  index: number,
  base: ScheduleEntry[],
  blockSizes: ReadonlyMap<string, number>,
): boolean {
  const step = removeUnplaceAt(overrides, index);
  if (!step) return false;
  return !hasStackedOccurrence(applyOverrides(base, step.next, blockSizes));
}

/** The tray contents: every unplace still in the log, carrying its index. */
export function unplacedList(
  overrides: ManualOverride[],
  base: ScheduleEntry[],
  blockSizes: ReadonlyMap<string, number>,
): UnplacedItem[] {
  return overrides.flatMap((override, index) =>
    override.kind === "unplace"
      ? [
          {
            index,
            subjectId: override.subjectId,
            day: override.at.day,
            slot: override.at.slot,
            blocked: !canPutBack(overrides, index, base, blockSizes),
          },
        ]
      : [],
  );
}

/** Tray row text: what left the grid, and where it sat. */
export const unplacedLabel = (item: UnplacedItem, subjectName: string, slotLabel: string): string =>
  `${subjectName} - was ${item.day} ${slotLabel}`;
