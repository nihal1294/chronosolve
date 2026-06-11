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
