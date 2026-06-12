import type { Entity, EntitySection } from "./problem-doc";

/** Header auto-matching + row->entity conversion for the CSV import wizard.

    Linking rule: list tokens (teacher/group references) and ids derived
    from names are slugged the same way, so "Instructor: Sannidhan M S"
    matches a professor imported as id "sannidhan_m_s". Explicitly mapped
    id columns are taken verbatim. */

export type ImportFieldKind = "text" | "int" | "idList" | "subjectType" | "roomType";

export interface ImportField {
  key: string;
  label: string;
  kind: ImportFieldKind;
  required?: boolean;
  /** Normalized header spellings that auto-match this field. */
  aliases: readonly string[];
}

const field = (
  key: string,
  label: string,
  kind: ImportFieldKind,
  aliases: string[],
  required = false,
): ImportField => ({ key, label, kind, required, aliases });

const ID = (aliases: string[]) => field("id", "ID (primary key)", "text", ["id", ...aliases]);
const NAME = (aliases: string[]) => field("name", "Name", "text", ["name", ...aliases], true);

export const IMPORT_FIELDS: Record<EntitySection, readonly ImportField[]> = {
  subjects: [
    ID(["courseid", "coursecode", "subjectid", "code"]),
    NAME(["title", "coursetitle", "coursename", "subjectname"]),
    field(
      "hours_per_week",
      "Hours per week",
      "int",
      ["hoursperweek", "hours", "credithours", "weeklyhours", "hrs"],
      true,
    ),
    field("type", "Type (theory/lab/elective)", "subjectType", [
      "type",
      "islab",
      "lab",
      "coursetype",
      "subjecttype",
    ]),
    field(
      "teacher_ids",
      "Teachers",
      "idList",
      [
        "teacherids",
        "teachers",
        "teacher",
        "instructor",
        "instructors",
        "instructorname",
        "faculty",
        "professor",
        "professors",
      ],
      true,
    ),
    field(
      "group_ids",
      "Student groups",
      "idList",
      ["groupids", "groups", "group", "section", "sections", "studentgroups"],
      true,
    ),
    field("max_per_day", "Max sessions per day", "int", ["maxperday"]),
    field("consecutive_hours", "Consecutive hours", "int", ["consecutivehours", "blocksize", "blockhours"]),
    field("preferred_room_type", "Preferred room type", "roomType", ["preferredroomtype", "roomtype"]),
  ],
  teachers: [
    ID(["teacherid", "instructorid", "facultyid", "staffid"]),
    NAME(["teachername", "instructorname", "instructor", "facultyname", "faculty", "professor", "fullname"]),
  ],
  student_groups: [
    ID(["groupid", "section", "sectionid"]),
    NAME(["groupname", "sectionname"]),
    field("size", "Size", "int", ["size", "strength", "students", "studentcount", "numstudents"], true),
  ],
  rooms: [
    ID(["roomid", "roomno", "roomnumber"]),
    NAME(["roomname"]),
    field("capacity", "Capacity", "int", ["capacity", "seats", "maxstudents"], true),
    field("type", "Type (lecture/lab/any)", "roomType", ["type", "roomtype", "category"]),
  ],
};

const normalize = (header: string): string => header.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Slug used for derived ids and list tokens, e.g. "Sannidhan M S" -> "sannidhan_m_s". */
export const slugId = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Propose header -> field-key assignments by normalized alias lookup.
    Unmatched headers map to ""; each field is claimed at most once. */
export function autoMatch(headers: readonly string[], section: EntitySection): Record<string, string> {
  const taken = new Set<string>();
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const wanted = normalize(header);
    const field = IMPORT_FIELDS[section].find((f) => !taken.has(f.key) && f.aliases.includes(wanted));
    mapping[header] = field?.key ?? "";
    if (field) taken.add(field.key);
  }
  return mapping;
}

/** Labels of required fields the mapping does not cover. The id field is
    satisfied by a mapped name column (ids are then derived from names). */
export function missingRequired(mapping: Record<string, string>, section: EntitySection): string[] {
  const mapped = new Set(Object.values(mapping));
  return IMPORT_FIELDS[section]
    .filter((field) => (field.required ?? false) || field.key === "id")
    .filter((field) => !mapped.has(field.key))
    .filter((field) => !(field.key === "id" && mapped.has("name")))
    .map((field) => field.label);
}

const SUBJECT_TYPES = ["theory", "lab", "elective"];
const ROOM_TYPES = ["lecture", "lab", "any"];

function coerce(field: ImportField, raw: string): { value?: unknown; error?: string } {
  if (field.kind === "int") {
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0)
      return { error: `${field.label} must be a positive whole number` };
    return { value };
  }
  if (field.kind === "idList") {
    const ids = raw.split(/[;,]/).map(slugId).filter(Boolean);
    return ids.length > 0 ? { value: ids } : { error: `${field.label} is empty` };
  }
  if (field.kind === "subjectType" || field.kind === "roomType") {
    const text = raw.trim().toLowerCase();
    if (field.kind === "subjectType" && ["true", "yes", "1"].includes(text)) return { value: "lab" };
    if (field.kind === "subjectType" && ["false", "no", "0"].includes(text)) return { value: "theory" };
    const allowed = field.kind === "subjectType" ? SUBJECT_TYPES : ROOM_TYPES;
    return allowed.includes(text) ? { value: text } : { error: `${field.label}: unknown value "${raw}"` };
  }
  return { value: raw.trim() };
}

export interface ImportResult {
  entities: Entity[];
  /** Human-readable per-row conversion problems (those rows are skipped). */
  errors: string[];
}

/** Convert parsed CSV rows into entities using the column mapping. */
export function applyMapping(
  rows: readonly Record<string, string>[],
  mapping: Record<string, string>,
  section: EntitySection,
): ImportResult {
  const headerFor = new Map(Object.entries(mapping).map(([header, key]) => [key, header]));
  const entities: Entity[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const entity: Record<string, unknown> = {};
    const rowErrors: string[] = [];
    for (const field of IMPORT_FIELDS[section]) {
      const header = headerFor.get(field.key);
      const raw = header ? (row[header] ?? "").trim() : "";
      if (raw === "") {
        if (field.required) rowErrors.push(`${field.label} is missing`);
        continue;
      }
      const { value, error } = coerce(field, raw);
      if (error) rowErrors.push(error);
      else entity[field.key] = value;
    }
    if (entity.id === undefined && typeof entity.name === "string") entity.id = slugId(entity.name);
    if (entity.id === undefined) rowErrors.push("no id or name to identify the row");
    if (rowErrors.length > 0) errors.push(`Row ${index + 1}: ${rowErrors.join("; ")}`);
    else entities.push(entity as Entity);
  });

  return { entities, errors };
}
