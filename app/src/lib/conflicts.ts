import type { ScheduleEntry } from "./solver-client";
import type { ConflictInputs } from "./conflict-model";
import { scheduleKey } from "./grid";

export type ConflictKind =
  | "teacher-double-book"
  | "group-double-book"
  | "room-double-book"
  | "unavailable"
  | "room-capacity"
  | "room-type"
  | "room-tags";

export interface Conflict {
  kind: ConflictKind;
  /** Plain-language description, mirroring the backend's wording. */
  message: string;
  /** "subject|day|slot" keys of every entry involved (grid highlighting, M8b). */
  entryKeys: string[];
}

/** The frontend mirror of the agreed hard-rule subset (see the M8 design's
    Post-M7 refresh). Everything else is backend authority via /score. */
export function findConflicts(inputs: ConflictInputs, schedule: ScheduleEntry[]): Conflict[] {
  return [
    ...doubleBookings(inputs, schedule),
    ...unavailability(inputs, schedule),
    ...roomEligibility(inputs, schedule),
  ];
}

const key = (e: ScheduleEntry) => scheduleKey(e.subject_id, e.day, e.slot);

const OWNER_LABEL: Record<string, string> = { teacher: "Teacher", group: "Group", room: "Room" };

function doubleBookings(inputs: ConflictInputs, schedule: ScheduleEntry[]): Conflict[] {
  const found: Conflict[] = [];
  const claims = new Map<string, ScheduleEntry[]>();
  const claim = (owner: string, entry: ScheduleEntry) => {
    const list = claims.get(owner) ?? [];
    list.push(entry);
    claims.set(owner, list);
  };
  for (const entry of schedule) {
    const at = `${entry.day}|${entry.slot}`;
    // Dedupe owner ids WITHIN an entry (a malformed ["t1", "t1"] is one
    // booking); each entry OCCURRENCE still counts, so a subject stacked
    // onto its own other occurrence double-books like the backend says.
    if (inputs.flags.teacherNoClash) {
      for (const t of new Set(entry.teacher_ids)) claim(`teacher|${t}|${at}`, entry);
    }
    if (inputs.flags.groupNoClash) {
      for (const g of new Set(entry.group_ids)) claim(`group|${g}|${at}`, entry);
    }
    if (inputs.flags.roomNoClash && entry.room_id) claim(`room|${entry.room_id}|${at}`, entry);
  }
  for (const [owner, entries] of claims) {
    if (entries.length < 2) continue;
    const [what, id, day, slot] = owner.split("|");
    found.push({
      kind: `${what}-double-book` as ConflictKind,
      message: `${OWNER_LABEL[what]} '${id}' double-booked on ${day} slot ${slot}`,
      entryKeys: [...new Set(entries.map(key))],
    });
  }
  return found;
}

function unavailability(inputs: ConflictInputs, schedule: ScheduleEntry[]): Conflict[] {
  if (!inputs.flags.respectAvailability) return [];
  const found: Conflict[] = [];
  const blocked = (byDay: Map<string, Set<number>> | undefined, e: ScheduleEntry) =>
    byDay?.get(e.day)?.has(e.slot) ?? false;
  for (const entry of schedule) {
    const offenders = [
      ...entry.teacher_ids.filter((t) => blocked(inputs.teacherUnavailable.get(t), entry)),
      ...entry.group_ids.filter((g) => blocked(inputs.groupUnavailable.get(g), entry)),
    ];
    for (const id of offenders) {
      found.push({
        kind: "unavailable",
        message: `'${id}' scheduled during unavailable ${entry.day} slot ${entry.slot}`,
        entryKeys: [key(entry)],
      });
    }
  }
  return found;
}

/** Mirror of compatible_rooms: room_type_matches + required-tag cover + the
    opt-in capacity check. Reservations are deliberately NOT mirrored - the
    backend prices them via /score (M8 design, Post-M7 refresh). */
function roomEligibility(inputs: ConflictInputs, schedule: ScheduleEntry[]): Conflict[] {
  const found: Conflict[] = [];
  const seen = new Set<string>(); // one conflict per (subject, room, kind)
  for (const entry of schedule) {
    if (!entry.room_id) continue;
    const room = inputs.rooms.get(entry.room_id);
    const subject = inputs.subjects.get(entry.subject_id);
    if (!room || !subject) continue;
    const emit = (kind: ConflictKind, message: string) => {
      const dedupe = `${entry.subject_id}|${entry.room_id}|${kind}`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);
      found.push({ kind, message, entryKeys: [key(entry)] });
    };
    const pref = subject.preferredRoomType;
    if (pref && pref !== "any" && room.type !== pref && room.type !== "any") {
      emit(
        "room-type",
        `Subject '${entry.subject_id}' needs a '${pref}' room but is in '${entry.room_id}' (${room.type})`,
      );
    }
    const missing = subject.requiredTags.filter((tag) => !room.tags.includes(tag));
    if (missing.length > 0) {
      emit(
        "room-tags",
        `Room '${entry.room_id}' lacks tags ${missing.join(", ")} required by '${entry.subject_id}'`,
      );
    }
    if (inputs.flags.roomCapacity && room.capacity !== null) {
      const need = subject.groupIds.reduce((sum, g) => sum + (inputs.groupSizes.get(g) ?? 0), 0);
      if (need > room.capacity) {
        emit(
          "room-capacity",
          `Room '${entry.room_id}' seats ${room.capacity} but '${entry.subject_id}' needs ${need}`,
        );
      }
    }
  }
  return found;
}
