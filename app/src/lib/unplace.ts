import { blockAnchor, scheduleKey } from "./grid";
import type { ManualOverride, UnplaceOverride } from "./overrides";
import type { ScheduleEntry } from "./solver-client";

/** One row of the "Unplaced" tray: the override's POSITION in the log (what
    Put back removes - the same unplace can recur after an undo/redo cycle, so
    object identity is not a stable handle) plus where the occurrence sat when
    it left the grid. */
export interface UnplacedItem {
  index: number;
  subjectId: string;
  day: string;
  slot: number;
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
  const ownKey = scheduleKey(entry.subject_id, entry.day, entry.slot);
  if (lockedKeys.has(ownKey)) return overrides;
  const anchor = blockAnchor(displaySchedule, entry, blockSizes);
  // The entry's object identity cannot go into the override - the log replays
  // from the BASE schedule, which rebuilds these objects - so record its
  // position among the entries sharing its slot instead. That is what tells
  // applyUnplace which card was clicked when a stack shares one key.
  const occurrence = displaySchedule
    .filter((other) => scheduleKey(other.subject_id, other.day, other.slot) === ownKey)
    .indexOf(entry);
  return [
    ...overrides,
    {
      kind: "unplace",
      subjectId: entry.subject_id,
      at: { day: anchor.day, slot: anchor.slot },
      ...(occurrence > 0 ? { occurrence } : {}),
    },
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

/** The tray contents: every unplace still in the log, carrying its index. */
export function unplacedList(overrides: ManualOverride[]): UnplacedItem[] {
  return overrides.flatMap((override, index) =>
    override.kind === "unplace"
      ? [{ index, subjectId: override.subjectId, day: override.at.day, slot: override.at.slot }]
      : [],
  );
}

/** Tray row text: what left the grid, and where it sat. */
export const unplacedLabel = (item: UnplacedItem, subjectName: string, slotLabel: string): string =>
  `${subjectName} - was ${item.day} ${slotLabel}`;
