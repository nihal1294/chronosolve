/** Read-only summaries of a parsed problem document, powering the sidebar
    counts, the Table View rows, and the timetable axis labels. */

export interface SubjectRow {
  id: string;
  name: string;
  hoursPerWeek: number;
  teacherIds: string[];
  groupIds: string[];
  kind: string;
  /** Block size; 1 = independently schedulable single slots. */
  consecutiveHours: number;
}

export interface TeacherRow {
  id: string;
  name: string;
  unavailable: string;
}

export interface GroupRow {
  id: string;
  name: string;
  size: number | null;
}

export interface RoomRow {
  id: string;
  name: string;
  capacity: number | null;
  type: string;
}

export interface PreAssignment {
  subjectId: string;
  day: string;
  slot: number;
}

export interface ProblemEntities {
  subjects: SubjectRow[];
  teachers: TeacherRow[];
  groups: GroupRow[];
  rooms: RoomRow[];
  preAssignments: PreAssignment[];
  days: string[];
  slotsPerDay: number;
  slotLabels: Record<number, string>;
}

type Raw = Record<string, unknown>;

const asRecord = (value: unknown): Raw => (typeof value === "object" && value !== null ? (value as Raw) : {});

const asList = (value: unknown): Raw[] => (Array.isArray(value) ? value.map(asRecord) : []);

const asStr = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);

const asNum = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asStrList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const idAndName = (raw: Raw): { id: string; name: string } => {
  const id = asStr(raw.id);
  return { id, name: asStr(raw.name, id) };
};

/** Render a teacher's unavailable map as "Friday 5,6 · Monday 1". */
const unavailableSummary = (value: unknown): string =>
  Object.entries(asRecord(value))
    .map(([day, slots]) => `${day} ${Array.isArray(slots) ? slots.join(",") : String(slots)}`)
    .join(" · ");

/** Extract sidebar/table summaries from a js-yaml-parsed problem document.

    Tolerates partial or malformed sections - anything unreadable simply
    yields empty rows so the UI can render while the user is still typing. */
export function parseEntities(problem: unknown): ProblemEntities {
  const doc = asRecord(problem);
  const time = asRecord(doc.time_structure);
  const slotLabels: Record<number, string> = {};
  for (const [slot, label] of Object.entries(asRecord(time.slot_labels))) {
    const index = Number(slot);
    if (Number.isInteger(index) && typeof label === "string") slotLabels[index] = label;
  }

  return {
    subjects: asList(doc.subjects).map((raw) => ({
      ...idAndName(raw),
      hoursPerWeek: asNum(raw.hours_per_week) ?? 0,
      teacherIds: asStrList(raw.teacher_ids),
      groupIds: asStrList(raw.group_ids),
      kind: asStr(raw.type, "theory"), // mirrors the Pydantic SubjectType default
      consecutiveHours: asNum(raw.consecutive_hours) ?? 1, // solver treats None as 1
    })),
    teachers: asList(doc.teachers).map((raw) => ({
      ...idAndName(raw),
      unavailable: unavailableSummary(raw.unavailable),
    })),
    groups: asList(doc.student_groups).map((raw) => ({
      ...idAndName(raw),
      size: asNum(raw.size),
    })),
    rooms: asList(doc.rooms).map((raw) => ({
      ...idAndName(raw),
      capacity: asNum(raw.capacity),
      type: asStr(raw.type, "any"),
    })),
    preAssignments: asList(doc.pre_assignments)
      .map((raw) => ({
        subjectId: asStr(raw.subject_id),
        day: asStr(raw.day),
        slot: asNum(raw.slot) ?? 0,
      }))
      .filter((pin) => pin.subjectId !== "" && pin.day !== "" && pin.slot > 0),
    days: asStrList(time.days),
    slotsPerDay: asNum(time.slots_per_day) ?? 0,
    slotLabels,
  };
}
