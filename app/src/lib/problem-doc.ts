import { load as yamlLoad, dump as yamlDump } from "js-yaml";

/** The problem document is the raw YAML mapping (snake_case keys), kept
    intact so fields the editors don't know about survive every update. */
export type ProblemDoc = Record<string, unknown>;

export type EntitySection = "subjects" | "teachers" | "student_groups" | "rooms";

export type Entity = { id: string } & Record<string, unknown>;

/** Parse YAML text into a problem doc. Empty text becomes an empty doc;
    a non-mapping document (list/scalar) is rejected. */
export function parseDoc(yamlText: string): ProblemDoc {
  const value = yamlLoad(yamlText);
  if (value === null || value === undefined) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Problem definition must be a YAML mapping");
  }
  return value as ProblemDoc;
}

/** Serialize a doc back to YAML (stable insertion order, no refs/anchors). */
export function serializeDoc(doc: ProblemDoc): string {
  return yamlDump(doc, { noRefs: true, lineWidth: 100 });
}

function sectionList(doc: ProblemDoc, section: EntitySection): Entity[] {
  const value = doc[section];
  return Array.isArray(value) ? (value as Entity[]) : [];
}

/** List a section's entities ([] when the section is missing or malformed). */
export function listEntities(doc: ProblemDoc, section: EntitySection): Entity[] {
  return sectionList(doc, section);
}

/** Add an entity, or replace the one sharing its id (position preserved). */
export function upsertEntity(doc: ProblemDoc, section: EntitySection, entity: Entity): ProblemDoc {
  const list = sectionList(doc, section);
  const index = list.findIndex((item) => item?.id === entity.id);
  const next = index === -1 ? [...list, entity] : list.map((item, i) => (i === index ? entity : item));
  return { ...doc, [section]: next };
}

/** Remove the entity with the given id; a missing section is a no-op. */
export function removeEntity(doc: ProblemDoc, section: EntitySection, id: string): ProblemDoc {
  if (!Array.isArray(doc[section])) return { ...doc };
  return { ...doc, [section]: sectionList(doc, section).filter((item) => item?.id !== id) };
}

function withConstraint(doc: ProblemDoc, group: "hard" | "soft", key: string, value: unknown): ProblemDoc {
  const constraints = (doc.constraints ?? {}) as Record<string, unknown>;
  const existing = (constraints[group] ?? {}) as Record<string, unknown>;
  return {
    ...doc,
    constraints: { ...constraints, [group]: { ...existing, [key]: value } },
  };
}

/** Toggle a hard constraint flag (e.g. room_no_clash). */
export function setHardFlag(doc: ProblemDoc, flag: string, value: boolean): ProblemDoc {
  return withConstraint(doc, "hard", flag, value);
}

/** Set a soft constraint weight, 0–100 (0 disables it). */
export function setSoftWeight(doc: ProblemDoc, name: string, weight: number): ProblemDoc {
  return withConstraint(doc, "soft", name, weight);
}

/** Read a hard flag, falling back when it has never been set (defaults are on). */
export function getHardFlag(doc: ProblemDoc, flag: string, fallback: boolean): boolean {
  const group = (doc.constraints as { hard?: Record<string, unknown> } | undefined)?.hard;
  const value = group?.[flag];
  return typeof value === "boolean" ? value : fallback;
}

/** Read a soft weight, 0 when unset. */
export function getSoftWeight(doc: ProblemDoc, name: string): number {
  const group = (doc.constraints as { soft?: Record<string, unknown> } | undefined)?.soft;
  const value = group?.[name];
  return typeof value === "number" ? value : 0;
}

/** One fixed placement: a subject pinned to a (day, slot). */
export interface PinSlot {
  subjectId: string;
  day: string;
  slot: number;
}

const matchesPin = (value: unknown, pin: PinSlot): boolean => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return entry.subject_id === pin.subjectId && entry.day === pin.day && entry.slot === pin.slot;
};

/** Pin a subject to a slot via pre_assignments; a no-op if already pinned. */
export function pinAssignment(doc: ProblemDoc, pin: PinSlot): ProblemDoc {
  const list = Array.isArray(doc.pre_assignments) ? doc.pre_assignments : [];
  if (list.some((entry) => matchesPin(entry, pin))) return { ...doc };
  const entry = { subject_id: pin.subjectId, day: pin.day, slot: pin.slot };
  return { ...doc, pre_assignments: [...list, entry] };
}

/** Remove the exact (subject, day, slot) pin; every other entry survives. */
export function unpinAssignment(doc: ProblemDoc, pin: PinSlot): ProblemDoc {
  if (!Array.isArray(doc.pre_assignments)) return { ...doc };
  return { ...doc, pre_assignments: doc.pre_assignments.filter((entry) => !matchesPin(entry, pin)) };
}
