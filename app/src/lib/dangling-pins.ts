import { scheduleKey } from "./grid";
import type { ProblemDoc } from "./problem-doc";
import type { ScheduleEntry } from "./solver-client";

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
    whose slot IS occupied in the base deliberately stays: it renders as a
    visible pinned block after reset (one click from unpin), unlike the
    dangling case. Returns the SAME doc when nothing dangles so callers can
    skip a no-op doc write; an empty schedule prunes nothing (there is no
    result to compare against); malformed entries always survive (doc
    round-trip). */
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
