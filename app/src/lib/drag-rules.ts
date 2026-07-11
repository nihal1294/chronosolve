import type { ScheduleEntry } from "./solver-client";
import { blockAnchor, scheduleKey } from "./grid";

/** react-dnd item type shared by SessionBlock (source) and grid cells (target). */
export const SESSION_DND_TYPE = "session";

/** What travels with a dragged session: the entry plus its block geometry,
    resolved against the display schedule at drag start. */
export interface DragItem {
  entry: ScheduleEntry;
  anchorDay: string;
  anchorSlot: number;
  size: number;
}

/** Geometric drop legality only. Conflicts (double-book, availability, room)
    never block a drop - mode A is "drop and see what breaks" (M8 design). */
export function canDropSession(item: DragItem, day: string, slot: number, maxSlot: number): boolean {
  if (slot + item.size - 1 > maxSlot) return false; // block would overflow the day
  if (day === item.anchorDay && slot === item.anchorSlot) return false; // self-drop
  return true;
}

/** The DragItem for grabbing `entry`, or null when it must not move: a pinned
    session is a hard pre-assignment in the doc, and dragging it would show a
    schedule the next solve contradicts (unpin first). */
export function sessionDragItem(
  entry: ScheduleEntry,
  lockedKeys: ReadonlySet<string>,
  displaySchedule: ScheduleEntry[],
  blockSizes: ReadonlyMap<string, number>,
): DragItem | null {
  if (lockedKeys.has(scheduleKey(entry.subject_id, entry.day, entry.slot))) return null;
  const anchor = blockAnchor(displaySchedule, entry, blockSizes);
  return {
    entry,
    anchorDay: anchor.day,
    anchorSlot: anchor.slot,
    size: blockSizes.get(entry.subject_id) ?? 1,
  };
}
