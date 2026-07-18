import type { ProblemDoc } from "./problem-doc";

/** Typed view of exactly the doc facts the conflict checker needs. Built
    from the RAW doc (ProblemEntities is a display summary and drops the
    structured availability, tags, and flags this needs). */
export interface SubjectFacts {
  teacherIds: string[];
  groupIds: string[];
  preferredRoomType: string | null;
  requiredTags: string[];
}

export interface RoomFacts {
  capacity: number | null;
  type: string;
  tags: string[];
  /** Subjects allowed by EVERY reservation entry on this room (rule 24);
      null when the room is unreserved. Empty set = reserved for nobody. */
  reservedFor: Set<string> | null;
}

export interface ConflictFlags {
  teacherNoClash: boolean;
  groupNoClash: boolean;
  roomNoClash: boolean;
  respectAvailability: boolean;
  roomCapacity: boolean;
}

export interface ConflictInputs {
  subjects: Map<string, SubjectFacts>;
  rooms: Map<string, RoomFacts>;
  groupSizes: Map<string, number>;
  teacherUnavailable: Map<string, Map<string, Set<number>>>;
  groupUnavailable: Map<string, Map<string, Set<number>>>;
  flags: ConflictFlags;
}

type Raw = Record<string, unknown>;
const asRecord = (v: unknown): Raw => (typeof v === "object" && v !== null ? (v as Raw) : {});
const asList = (v: unknown): Raw[] => (Array.isArray(v) ? v.map(asRecord) : []);
const asStr = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const asNum = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const asStrList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((item): item is string => typeof item === "string") : [];
const asBool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

function unavailableMap(value: unknown): Map<string, Set<number>> {
  const byDay = new Map<string, Set<number>>();
  for (const [day, slots] of Object.entries(asRecord(value))) {
    if (!Array.isArray(slots)) continue;
    byDay.set(day, new Set(slots.filter((s): s is number => typeof s === "number")));
  }
  return byDay;
}

/** roomId -> intersection of its reservation entries' subject_ids. The
    backend excludes a room when ANY entry omits the subject, which is
    exactly membership in the intersection. */
function reservationSets(value: unknown): Map<string, Set<string>> {
  const byRoom = new Map<string, Set<string>>();
  for (const res of asList(value)) {
    const roomId = asStr(res.room_id);
    const allowed = new Set(asStrList(res.subject_ids));
    const prior = byRoom.get(roomId);
    byRoom.set(roomId, prior ? new Set([...prior].filter((s) => allowed.has(s))) : allowed);
  }
  return byRoom;
}

export function buildConflictInputs(doc: ProblemDoc): ConflictInputs {
  const raw = asRecord(doc);
  const hard = asRecord(asRecord(raw.constraints).hard);
  const reservations = reservationSets(asRecord(asRecord(raw.constraints).advanced).room_reservations);
  const subjects = new Map<string, SubjectFacts>();
  for (const s of asList(raw.subjects)) {
    subjects.set(asStr(s.id), {
      teacherIds: asStrList(s.teacher_ids),
      groupIds: asStrList(s.group_ids),
      preferredRoomType: typeof s.preferred_room_type === "string" ? s.preferred_room_type : null,
      requiredTags: asStrList(s.required_tags),
    });
  }
  const rooms = new Map<string, RoomFacts>();
  for (const r of asList(raw.rooms)) {
    const id = asStr(r.id);
    rooms.set(id, {
      capacity: asNum(r.capacity),
      type: asStr(r.type, "any"),
      tags: asStrList(r.tags),
      reservedFor: reservations.get(id) ?? null,
    });
  }
  const groupSizes = new Map<string, number>();
  const groupUnavailable = new Map<string, Map<string, Set<number>>>();
  for (const g of asList(raw.student_groups)) {
    const size = asNum(g.size);
    if (size !== null) groupSizes.set(asStr(g.id), size);
    groupUnavailable.set(asStr(g.id), unavailableMap(g.unavailable));
  }
  const teacherUnavailable = new Map<string, Map<string, Set<number>>>();
  for (const t of asList(raw.teachers)) {
    teacherUnavailable.set(asStr(t.id), unavailableMap(t.unavailable));
  }
  return {
    subjects,
    rooms,
    groupSizes,
    teacherUnavailable,
    groupUnavailable,
    flags: {
      teacherNoClash: asBool(hard.teacher_no_clash, true),
      groupNoClash: asBool(hard.group_no_clash, true),
      roomNoClash: asBool(hard.room_no_clash, true),
      respectAvailability: asBool(hard.respect_availability, true),
      roomCapacity: asBool(hard.room_capacity, false),
    },
  };
}
