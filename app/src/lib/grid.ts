import type { ScheduleEntry } from "./solver-client";

export type GroupGrid = Map<string, Map<string, Map<number, ScheduleEntry>>>;

/** Index schedule entries as group -> day -> slot for grid rendering. */
export function pivotByGroup(schedule: ScheduleEntry[]): GroupGrid {
  const grid: GroupGrid = new Map();
  for (const entry of schedule) {
    for (const groupId of entry.group_ids) {
      const days = grid.get(groupId) ?? new Map<string, Map<number, ScheduleEntry>>();
      const slots = days.get(entry.day) ?? new Map<number, ScheduleEntry>();
      // A valid solve never collides; surface malformed input instead of hiding it.
      if (slots.has(entry.slot)) {
        console.warn(`Schedule collision dropped: group=${groupId} day=${entry.day} slot=${entry.slot}`);
      }
      slots.set(entry.slot, entry);
      days.set(entry.day, slots);
      grid.set(groupId, days);
    }
  }
  return grid;
}

/** Scheduled slot count per subject id (drives the table's Status column). */
export function countScheduled(schedule: ScheduleEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of schedule) counts.set(entry.subject_id, (counts.get(entry.subject_id) ?? 0) + 1);
  return counts;
}

/** subject|day|slot identity shared by schedule entries and pre-assignment pins. */
export const scheduleKey = (subjectId: string, day: string, slot: number): string =>
  `${subjectId}|${day}|${slot}`;

/** Whether any slot holds two occurrences of ONE subject - the invariant the
    whole system rests on. The solver creates a single boolean per (subject,
    day, slot), so no solve can emit this, and pre_assignments key on the same
    triple, so no problem file can store it. Two DIFFERENT subjects sharing a
    slot is an ordinary conflict and stays false here: that one is legal to
    show, merely wrong, and the conflict checker prices it. */
export function hasStackedOccurrence(schedule: ScheduleEntry[]): boolean {
  const seen = new Set<string>();
  for (const entry of schedule) {
    const key = scheduleKey(entry.subject_id, entry.day, entry.slot);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/** The entry starting the consecutive-hours block that covers `entry`.

    The solver emits one ScheduleEntry per occupied slot, but a
    pre_assignment for a block subject means the block START slot. Blocks
    tile a contiguous same-day run in whole multiples of the block size, so
    the anchor falls out of the run start. Single-slot subjects (and unknown
    block sizes) anchor to themselves. */
export function blockAnchor(
  schedule: ScheduleEntry[],
  entry: ScheduleEntry,
  blockSizes: ReadonlyMap<string, number>,
): ScheduleEntry {
  const size = blockSizes.get(entry.subject_id) ?? 1;
  if (size <= 1) return entry;
  const sameDay = schedule.filter(
    (other) => other.subject_id === entry.subject_id && other.day === entry.day,
  );
  const occupied = new Set(sameDay.map((other) => other.slot));
  let runStart = entry.slot;
  while (occupied.has(runStart - 1)) runStart -= 1;
  const anchorSlot = runStart + Math.floor((entry.slot - runStart) / size) * size;
  return sameDay.find((other) => other.slot === anchorSlot) ?? entry;
}

/** Expand start-slot pins to every slot their block covers, so all hours of
    a pinned block render locked and flip the menu to Unpin. */
export function expandLockedKeys(
  schedule: ScheduleEntry[],
  pinKeys: ReadonlySet<string>,
  blockSizes: ReadonlyMap<string, number>,
): Set<string> {
  const locked = new Set<string>();
  for (const entry of schedule) {
    const anchor = blockAnchor(schedule, entry, blockSizes);
    if (pinKeys.has(scheduleKey(anchor.subject_id, anchor.day, anchor.slot))) {
      locked.add(scheduleKey(entry.subject_id, entry.day, entry.slot));
    }
  }
  return locked;
}
