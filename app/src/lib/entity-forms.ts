import type { Entity, EntitySection } from "./problem-doc";

/** Sidebar/table entity kinds → problem-doc sections. */
const KIND_TO_SECTION = {
  subjects: "subjects",
  teachers: "teachers",
  groups: "student_groups",
  rooms: "rooms",
} as const satisfies Record<string, EntitySection>;

export type EntityKind = keyof typeof KIND_TO_SECTION;

export const sectionForKind = (kind: EntityKind): EntitySection => KIND_TO_SECTION[kind];

export type FieldKind = "text" | "int" | "select" | "idList" | "unavailable";

export interface EntityField {
  /** Doc key (snake_case, mirrors the Pydantic model) and FormValues key. */
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Static select options; "" renders as "(none)" and clears the key. */
  options?: readonly string[];
  /** Entity list providing the idList checkboxes. */
  optionsFrom?: "teachers" | "groups";
  help?: string;
}

/** text/int/select hold the raw input string; idList holds ids;
    unavailable holds the per-day comma-list inputs. */
export type FormValues = Record<string, string | string[] | Record<string, string>>;

const ID_FIELD: EntityField = { key: "id", label: "ID", kind: "text", required: true };
const NAME_FIELD: EntityField = { key: "name", label: "Name", kind: "text", required: true };
const UNAVAILABLE_FIELD: EntityField = {
  key: "unavailable",
  label: "Unavailable slots",
  kind: "unavailable",
  help: "Comma-separated slot numbers per day, e.g. 1, 2",
};

export const ENTITY_FIELDS: Record<EntitySection, readonly EntityField[]> = {
  subjects: [
    { ...ID_FIELD, help: "Unique code shown on timetable blocks, e.g. DAA" },
    NAME_FIELD,
    { key: "hours_per_week", label: "Hours per week", kind: "int", required: true },
    { key: "type", label: "Type", kind: "select", options: ["theory", "lab", "elective"] },
    { key: "teacher_ids", label: "Teachers", kind: "idList", optionsFrom: "teachers", required: true },
    { key: "group_ids", label: "Student groups", kind: "idList", optionsFrom: "groups", required: true },
    { key: "max_per_day", label: "Max sessions per day", kind: "int", help: "Blank = 1" },
    { key: "consecutive_hours", label: "Consecutive hours", kind: "int", help: "Block size for labs" },
    {
      key: "preferred_room_type",
      label: "Preferred room type",
      kind: "select",
      options: ["", "lecture", "lab", "any"],
    },
  ],
  teachers: [ID_FIELD, NAME_FIELD, UNAVAILABLE_FIELD],
  student_groups: [
    ID_FIELD,
    NAME_FIELD,
    { key: "size", label: "Size", kind: "int", required: true },
    { key: "department", label: "Department", kind: "text", help: "Optional, for filtering, e.g. CSE" },
    { key: "semester", label: "Semester", kind: "text", help: "Optional, for filtering, e.g. 3" },
  ],
  rooms: [
    ID_FIELD,
    NAME_FIELD,
    { key: "capacity", label: "Capacity", kind: "int", required: true },
    // "any" first: selects seed from options[0], which must match the model default
    { key: "type", label: "Type", kind: "select", options: ["any", "lecture", "lab"] },
  ],
};

const isString = (value: unknown): value is string => typeof value === "string";

/** Seed form inputs from an existing entity (or blanks for create mode). */
export function entityToForm(fields: readonly EntityField[], entity: Entity | null): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    const raw = entity?.[field.key];
    if (field.kind === "idList") {
      values[field.key] = Array.isArray(raw) ? raw.filter(isString) : [];
    } else if (field.kind === "unavailable") {
      const map: Record<string, string> = {};
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        for (const [day, slots] of Object.entries(raw))
          map[day] = Array.isArray(slots) ? slots.join(", ") : String(slots);
      }
      values[field.key] = map;
    } else if (raw === undefined || raw === null) {
      // Selects seed with their first option so the rendered choice and the
      // saved value can never disagree (options[0] mirrors the model default).
      values[field.key] = field.kind === "select" ? (field.options?.[0] ?? "") : "";
    } else {
      values[field.key] = String(raw);
    }
  }
  return values;
}

type FieldUpdate = { set: unknown } | { clear: true } | { error: string };

function readScalar(field: EntityField, raw: string): FieldUpdate {
  const text = raw.trim();
  if (text === "") return field.required ? { error: "Required" } : { clear: true };
  if (field.kind !== "int") return { set: text };
  const value = Number(text);
  if (!Number.isInteger(value) || value <= 0) return { error: "Must be a positive whole number" };
  return { set: value };
}

function readUnavailable(inputs: Record<string, string>): FieldUpdate {
  const map: Record<string, number[]> = {};
  for (const [day, text] of Object.entries(inputs)) {
    if (!text.trim()) continue;
    const slots = text.split(",").map((token) => Number(token.trim()));
    if (slots.some((slot) => !Number.isInteger(slot) || slot <= 0))
      return { error: `${day}: use comma-separated slot numbers, e.g. 1, 2` };
    map[day] = slots;
  }
  return Object.keys(map).length === 0 ? { clear: true } : { set: map };
}

function readField(field: EntityField, value: FormValues[string]): FieldUpdate {
  if (field.kind === "idList") {
    const ids = Array.isArray(value) ? value : [];
    if (field.required && ids.length === 0) return { error: "Select at least one" };
    return { set: [...ids] };
  }
  if (field.kind === "unavailable")
    return readUnavailable(typeof value === "object" && !Array.isArray(value) ? value : {});
  return readScalar(field, isString(value) ? value : "");
}

export interface FormResult {
  /** The entity to upsert, or null when errors block the save. */
  entity: Entity | null;
  /** Per-field messages, keyed by EntityField.key. */
  errors: Record<string, string>;
}

/** Map form inputs onto an entity. Editing starts from `base` so fields the
    form doesn't know about survive; cleared optionals are removed entirely
    (no `key: null` noise in the YAML). */
export function formToEntity(
  fields: readonly EntityField[],
  values: FormValues,
  options: { base: Entity | null; existingIds: readonly string[] },
): FormResult {
  const errors: Record<string, string> = {};
  const entity: Record<string, unknown> = { ...(options.base ?? {}) };
  for (const field of fields) {
    const update = readField(field, values[field.key]);
    if ("error" in update) errors[field.key] = update.error;
    else if ("clear" in update) delete entity[field.key];
    else entity[field.key] = update.set;
  }
  if (options.base === null && !errors.id && options.existingIds.includes(entity.id as string)) {
    errors.id = "An entry with this ID already exists";
  }
  if (Object.keys(errors).length > 0) return { entity: null, errors };
  return { entity: entity as Entity, errors };
}
