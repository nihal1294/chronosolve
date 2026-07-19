import type { ScheduleEntry } from "./solver-client";
import { scheduleKey } from "./grid";

/** One manual placement decision. `from` is the block ANCHOR (start slot)
    the session occupied when the user made the move; `to` is the new anchor. */
export interface MoveOverride {
  kind: "move";
  subjectId: string;
  from: { day: string; slot: number };
  to: { day: string; slot: number };
}

/** A room reassignment for the block anchored at `at` when the change was
    made. Later moves of that block carry the room along (applyMove copies
    entry fields), so the composition order just works. */
export interface RoomOverride {
  kind: "room";
  subjectId: string;
  at: { day: string; slot: number };
  roomId: string;
}

export type ManualOverride = MoveOverride | RoomOverride;

/** The shown schedule with every override applied, in order. Pure: the
    solver result is never mutated, so clearing overrides restores it. */
export function applyOverrides(
  schedule: ScheduleEntry[],
  overrides: ManualOverride[],
  blockSizes: ReadonlyMap<string, number>,
): ScheduleEntry[] {
  let current = schedule;
  for (const override of overrides) {
    current =
      override.kind === "move"
        ? applyMove(current, override, blockSizes)
        : applyRoom(current, override, blockSizes);
  }
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

function applyRoom(
  schedule: ScheduleEntry[],
  change: RoomOverride,
  blockSizes: ReadonlyMap<string, number>,
): ScheduleEntry[] {
  const size = blockSizes.get(change.subjectId) ?? 1;
  const slotKey = (i: number) => scheduleKey(change.subjectId, change.at.day, change.at.slot + i);
  const targetKeys = new Set(Array.from({ length: size }, (_, i) => slotKey(i)));
  // First occupant per covered key, matching applyMove's stacked-occurrence
  // rule; identity return when nothing changes (skips downstream re-derives).
  const retargeted = new Set<string>();
  let touched = false;
  const next = schedule.map((entry) => {
    const key = scheduleKey(entry.subject_id, entry.day, entry.slot);
    if (entry.subject_id !== change.subjectId || !targetKeys.has(key) || retargeted.has(key)) {
      return entry;
    }
    retargeted.add(key);
    if (entry.room_id === change.roomId) return entry;
    touched = true;
    return { ...entry, room_id: change.roomId };
  });
  return touched ? next : schedule;
}
