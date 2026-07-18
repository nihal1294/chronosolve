import type { ScheduleEntry } from "./solver-client";
import type { PreAssignment } from "./entities";
import { scheduleKey } from "./grid";
import { pinAssignment, type PinSlot, type ProblemDoc } from "./problem-doc";

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

/** One pin per moved OCCURRENCE (block-start semantics): the backend applies
    every pre-assignment independently, so two moved occurrences of a subject
    need two pins. A move whose `from` matches an earlier pin re-moves that
    occurrence, replacing its pin and CARRYING its room; a room change upserts
    the room onto the pin at its slot, creating the time pin when absent (a
    persisted room change necessarily pins the slot - the primitive's shape).
    Sorted for stable serialization; Apply feeds these through problem-doc
    pinAssignment. */
export function overridesToPreAssignments(overrides: ManualOverride[]): PreAssignment[] {
  const at = (subject: string, day: string, slot: number) => `${subject}|${day}|${slot}`;
  const pins = new Map<string, PreAssignment>();
  for (const o of overrides) {
    if (o.kind === "move") {
      const prior = pins.get(at(o.subjectId, o.from.day, o.from.slot));
      pins.delete(at(o.subjectId, o.from.day, o.from.slot));
      pins.set(at(o.subjectId, o.to.day, o.to.slot), {
        subjectId: o.subjectId,
        day: o.to.day,
        slot: o.to.slot,
        ...(prior?.roomId === undefined ? {} : { roomId: prior.roomId }),
      });
    } else {
      pins.set(at(o.subjectId, o.at.day, o.at.slot), {
        subjectId: o.subjectId,
        day: o.at.day,
        slot: o.at.slot,
        roomId: o.roomId,
      });
    }
  }
  return [...pins.values()].sort(
    (a, b) => a.subjectId.localeCompare(b.subjectId) || a.day.localeCompare(b.day) || a.slot - b.slot,
  );
}

/** Fold the session's pins into the doc ("Apply edits"). Upserts through
    pinAssignment; returns the SAME doc object when every pin is already
    present so callers can skip the doc write entirely. */
export function applyPins(doc: ProblemDoc, pins: PinSlot[]): ProblemDoc {
  let current = doc;
  let changed = false;
  for (const pin of pins) {
    const next = pinAssignment(current, pin);
    // pinAssignment's no-op contract: new doc object, SAME list reference.
    if (next.pre_assignments !== current.pre_assignments) {
      current = next;
      changed = true;
    }
  }
  return changed ? current : doc;
}

/** What Apply would change: pins absent from the doc (`added`) and the PRIOR
    versions of pins whose room it would overwrite (`replaced`) - the undo
    payload for an apply action. Mirrors pinAssignment's upsert rule exactly,
    so added/replaced are non-empty iff applyPins returns a new doc
    (contract-tested). Assumes unique slot triples per pin, which
    overridesToPreAssignments guarantees. */
export function pinDiff(doc: ProblemDoc, pins: PinSlot[]): { added: PinSlot[]; replaced: PinSlot[] } {
  const list = Array.isArray(doc.pre_assignments) ? (doc.pre_assignments as Record<string, unknown>[]) : [];
  const added: PinSlot[] = [];
  const replaced: PinSlot[] = [];
  for (const pin of pins) {
    const prior = list.find(
      (e) => e.subject_id === pin.subjectId && e.day === pin.day && e.slot === pin.slot,
    );
    if (!prior) added.push(pin);
    else if (pin.roomId !== undefined && prior.room_id !== pin.roomId) {
      replaced.push({
        subjectId: pin.subjectId,
        day: pin.day,
        slot: pin.slot,
        ...(typeof prior.room_id === "string" ? { roomId: prior.room_id } : {}),
      });
    }
  }
  return { added, replaced };
}

/** How many session pins the doc does not carry yet (Apply badge + save
    warning). Applied means a doc entry matches subject, day, slot AND room -
    a different room would re-solve away from what the screen shows. */
export function unappliedPinCount(doc: ProblemDoc, overrides: ManualOverride[]): number {
  const list = Array.isArray(doc.pre_assignments) ? (doc.pre_assignments as Record<string, unknown>[]) : [];
  const present = new Set(list.map((e) => `${e.subject_id}|${e.day}|${e.slot}|${e.room_id ?? ""}`));
  return overridesToPreAssignments(overrides).filter(
    (pin) => !present.has(`${pin.subjectId}|${pin.day}|${pin.slot}|${pin.roomId ?? ""}`),
  ).length;
}
