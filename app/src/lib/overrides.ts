import type { ScheduleEntry } from "./solver-client";
import type { PreAssignment } from "./entities";
import { scheduleKey } from "./grid";

/** One manual placement decision. `from` is the block ANCHOR (start slot)
    the session occupied when the user made the move; `to` is the new anchor.
    Room and lock override kinds arrive in M8c. */
export interface MoveOverride {
  kind: "move";
  subjectId: string;
  from: { day: string; slot: number };
  to: { day: string; slot: number };
}

export type ManualOverride = MoveOverride;

/** The shown schedule with every override applied, in order. Pure: the
    solver result is never mutated, so clearing overrides restores it. */
export function applyOverrides(
  schedule: ScheduleEntry[],
  overrides: ManualOverride[],
  blockSizes: ReadonlyMap<string, number>,
): ScheduleEntry[] {
  let current = schedule;
  for (const override of overrides) current = applyMove(current, override, blockSizes);
  return current;
}

function applyMove(
  schedule: ScheduleEntry[],
  move: MoveOverride,
  blockSizes: ReadonlyMap<string, number>,
): ScheduleEntry[] {
  const size = blockSizes.get(move.subjectId) ?? 1;
  const slotKey = (i: number) => scheduleKey(move.subjectId, move.from.day, move.from.slot + i);
  const sourceKeys = new Set(Array.from({ length: size }, (_, i) => slotKey(i)));
  // Move ONE entry per covered source slot, each keeping its own fields
  // (room_id in particular). Extra occupants of a source key - a stacked
  // occurrence awaiting conflict resolution - stay where they are.
  const moving = new Map<string, ScheduleEntry>();
  const kept: ScheduleEntry[] = [];
  for (const entry of schedule) {
    const key = scheduleKey(entry.subject_id, entry.day, entry.slot);
    if (sourceKeys.has(key) && !moving.has(key)) moving.set(key, entry);
    else kept.push(entry);
  }
  if (moving.size === 0) return schedule; // stale: the block is no longer at `from`
  const moved: ScheduleEntry[] = [];
  for (let i = 0; i < size; i++) {
    const source = moving.get(slotKey(i));
    if (source) moved.push({ ...source, day: move.to.day, slot: move.to.slot + i });
  }
  return [...kept, ...moved];
}

/** One pin per moved OCCURRENCE (block-start semantics): the backend applies
    every pre-assignment independently, so two moved occurrences of a subject
    need two pins. A move whose `from` matches an earlier pin re-moves that
    occurrence and replaces its pin; two occurrences moved onto one slot
    collapse to one pin, all the backend's boolean assignment vars can express.
    Sorted for stable serialization; M8c feeds these through problem-doc
    pinAssignment on save. */
export function overridesToPreAssignments(overrides: ManualOverride[]): PreAssignment[] {
  const at = (subject: string, day: string, slot: number) => `${subject}|${day}|${slot}`;
  const pins = new Map<string, PreAssignment>();
  for (const o of overrides) {
    pins.delete(at(o.subjectId, o.from.day, o.from.slot));
    pins.set(at(o.subjectId, o.to.day, o.to.slot), {
      subjectId: o.subjectId,
      day: o.to.day,
      slot: o.to.slot,
    });
  }
  return [...pins.values()].sort(
    (a, b) => a.subjectId.localeCompare(b.subjectId) || a.day.localeCompare(b.day) || a.slot - b.slot,
  );
}
