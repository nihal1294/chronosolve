/** Plain-language helpers for the rule cards: resolve entity-ref params to display
    names, and parse/format the free-text tag input. Pure, so unit-tested. */

import type { ProblemEntities } from "./entities";
import type { ParamDef, RuleInstance, RuleTemplate } from "./rule-templates";

export interface NameMaps {
  subject: Map<string, string>;
  teacher: Map<string, string>;
  group: Map<string, string>;
  room: Map<string, string>;
}

const toMap = (rows: { id: string; name: string }[]) => new Map(rows.map((r) => [r.id, r.name]));

/** id -> display-name maps for each entity kind, from parsed problem entities. */
export function buildNameMaps(entities: ProblemEntities): NameMaps {
  return {
    subject: toMap(entities.subjects),
    teacher: toMap(entities.teachers),
    group: toMap(entities.groups),
    room: toMap(entities.rooms),
  };
}

/** Split a comma-separated tag string into trimmed, non-empty tags. */
export function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/** Join a tag array back to a comma-separated string (tolerates non-arrays). */
export function formatTags(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

const named = (map: Map<string, string>, value: unknown) => map.get(String(value)) ?? String(value);

function paramDisplay(param: ParamDef, value: unknown, names: NameMaps): string {
  switch (param.kind) {
    case "subject":
      return named(names.subject, value);
    case "teacher":
      return named(names.teacher, value);
    case "group":
      return named(names.group, value);
    case "room":
      return named(names.room, value);
    case "subjects":
      return Array.isArray(value) ? value.map((v) => named(names.subject, v)).join(", ") : "";
    case "slots":
      return Array.isArray(value) ? `slots ${value.join(", ")}` : "";
    case "tags":
      return formatTags(value);
    case "number":
      return value == null ? "" : String(value);
    default:
      return value == null ? "" : String(value); // day, half
  }
}

/** A plain-language summary of a rule's params (entity refs resolved to names);
    empty for a global toggle that has no params. */
export function summarizeParams(template: RuleTemplate, instance: RuleInstance, names: NameMaps): string {
  return template.params
    .map((param) => paramDisplay(param, instance.params[param.key], names))
    .filter((part) => part.length > 0)
    .join(" · ");
}
