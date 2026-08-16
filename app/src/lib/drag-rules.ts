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

/** Drop legality: geometry, plus the one-session-per-(subject, day, slot) rule
    the rest of the system is built on. CONFLICTS still never block a drop -
    mode A is "drop and see what breaks" (M8 design) - so landing on another
    subject stays legal and the conflict checker paints it.

    Stacking a subject on ITSELF is different in kind from a conflict: the
    solver models one boolean per (subject, day, slot) and pre_assignments key
    on that same triple, so no solve can produce it and no problem file can
    store it. Allowing it only gives the block-anchor maths an occupied run it
    cannot decompose and the pin plan two occupants for one key. `occupied` is
    every "subject|day|slot" the DISPLAY schedule fills (not the one grid being
    rendered - a room perspective splits a subject's occurrences across grids). */
export function canDropSession(
  item: DragItem,
  to: { day: string; slot: number },
  maxSlot: number,
  occupied: ReadonlySet<string>,
): boolean {
  if (to.slot + item.size - 1 > maxSlot) return false; // block would overflow the day
  if (to.day === item.anchorDay && to.slot === item.anchorSlot) return false; // self-drop
  const subject = item.entry.subject_id;
  const covers = (day: string, start: number) =>
    Array.from({ length: item.size }, (_, i) => scheduleKey(subject, day, start + i));
  // The block's own hours are what is moving, so a slide into its own
  // footprint (1-2 onto 2-3) is not a second occurrence.
  const own = new Set(covers(item.anchorDay, item.anchorSlot));
  return covers(to.day, to.slot).every((key) => own.has(key) || !occupied.has(key));
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
