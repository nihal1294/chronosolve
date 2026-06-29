/** Building blocks for the M7.2 rule registry: the template types and the three
    factory shapes (advanced-list, per-entity field, global toggle) that map an
    authored rule to/from the canonical M7.1 schema. The registry itself lives in
    rule-templates.ts. */

import {
  appendAdvancedItem,
  getAdvancedList,
  getHardFlag,
  getSoftWeight,
  listEntities,
  removeAdvancedItem,
  setEntityField,
  setHardFlag,
  setSoftWeight,
  type EntitySection,
  type ProblemDoc,
} from "./problem-doc";

export type ParamKind =
  | "subject"
  | "teacher"
  | "group"
  | "room"
  | "subjects"
  | "slots"
  | "tags"
  | "day"
  | "half"
  | "number";

export interface ParamDef {
  key: string;
  label: string;
  kind: ParamKind;
}

export type RuleCategory = "Time" | "Teacher" | "Group" | "Subject" | "Room" | "Fairness";
export type RuleMode = "hard" | "soft";

export interface RuleInstance {
  templateId: string;
  params: Record<string, unknown>;
}

export interface RuleTemplate {
  id: string;
  category: RuleCategory;
  label: string;
  mode: RuleMode;
  params: ParamDef[];
  /** Global soft-weight lever (the importance control); set only for soft rules. */
  weightKey?: string;
  serialize: (instance: RuleInstance, doc: ProblemDoc) => ProblemDoc;
  derive: (doc: ProblemDoc) => RuleInstance[];
  /** Remove the index-th derived instance of this template from the doc. */
  remove: (doc: ProblemDoc, index: number) => ProblemDoc;
}

export const DEFAULT_SOFT_WEIGHT = 50;
type Params = Record<string, unknown>;

export const SUBJECT = (key: string, label: string): ParamDef => ({ key, label, kind: "subject" });

interface ListSpec {
  id: string;
  category: RuleCategory;
  label: string;
  mode: RuleMode;
  params: ParamDef[];
  listKey: string;
  weightKey?: string;
  toEntry: (params: Params) => unknown;
  fromEntry: (entry: Params) => Params;
}

/** A rule backed by an advanced-constraint list (breaks, pairs, reservations...). */
export function listTemplate(spec: ListSpec): RuleTemplate {
  return {
    id: spec.id,
    category: spec.category,
    label: spec.label,
    mode: spec.mode,
    params: spec.params,
    weightKey: spec.weightKey,
    serialize: (instance, doc) => {
      const next = appendAdvancedItem(doc, spec.listKey, spec.toEntry(instance.params));
      return spec.weightKey && getSoftWeight(next, spec.weightKey) === 0
        ? setSoftWeight(next, spec.weightKey, DEFAULT_SOFT_WEIGHT)
        : next;
    },
    derive: (doc) =>
      getAdvancedList(doc, spec.listKey).map((entry) => ({
        templateId: spec.id,
        params: spec.fromEntry(entry as Params),
      })),
    remove: (doc, index) => removeAdvancedItem(doc, spec.listKey, index),
  };
}

interface EntityFieldSpec {
  id: string;
  category: RuleCategory;
  label: string;
  section: EntitySection;
  field: string;
  idParam: ParamDef;
  valueParam: ParamDef;
}

/** A hard rule backed by a per-entity field (allowed_slots, required_tags...). */
export function entityFieldTemplate(spec: EntityFieldSpec): RuleTemplate {
  const present = (v: unknown) => v !== undefined && v !== null && (!Array.isArray(v) || v.length > 0);
  return {
    id: spec.id,
    category: spec.category,
    label: spec.label,
    mode: "hard",
    params: [spec.idParam, spec.valueParam],
    serialize: (instance, doc) =>
      setEntityField(
        doc,
        spec.section,
        instance.params[spec.idParam.key] as string,
        spec.field,
        instance.params[spec.valueParam.key],
      ),
    derive: (doc) =>
      listEntities(doc, spec.section)
        .filter((e) => present(e[spec.field]))
        .map((e) => ({
          templateId: spec.id,
          params: { [spec.idParam.key]: e.id, [spec.valueParam.key]: e[spec.field] },
        })),
    remove: (doc, index) => {
      const target = listEntities(doc, spec.section).filter((e) => present(e[spec.field]))[index];
      return target ? setEntityField(doc, spec.section, target.id, spec.field, undefined) : doc;
    },
  };
}

interface ToggleSpec {
  id: string;
  category: RuleCategory;
  label: string;
  mode: RuleMode;
  hardFlag?: string;
  weightKey?: string;
}

/** A global on/off rule (one config flag or soft weight), no per-instance params. */
export function globalToggleTemplate(spec: ToggleSpec): RuleTemplate {
  // Fail at definition time rather than silently reading/writing key "" - one of
  // the two levers must be set for isOn/turnOn/turnOff to target a real field.
  if (spec.hardFlag === undefined && spec.weightKey === undefined) {
    throw new Error(`globalToggleTemplate ${spec.id}: needs a hardFlag or a weightKey`);
  }
  const isOn = (doc: ProblemDoc) =>
    spec.hardFlag !== undefined
      ? getHardFlag(doc, spec.hardFlag, false)
      : getSoftWeight(doc, spec.weightKey ?? "") > 0;
  const turnOn = (doc: ProblemDoc) =>
    spec.hardFlag !== undefined
      ? setHardFlag(doc, spec.hardFlag, true)
      : setSoftWeight(doc, spec.weightKey ?? "", DEFAULT_SOFT_WEIGHT);
  const turnOff = (doc: ProblemDoc) =>
    spec.hardFlag !== undefined
      ? setHardFlag(doc, spec.hardFlag, false)
      : setSoftWeight(doc, spec.weightKey ?? "", 0);
  return {
    id: spec.id,
    category: spec.category,
    label: spec.label,
    mode: spec.mode,
    params: [],
    weightKey: spec.weightKey,
    serialize: (_instance, doc) => turnOn(doc),
    derive: (doc) => (isOn(doc) ? [{ templateId: spec.id, params: {} }] : []),
    remove: (doc) => turnOff(doc),
  };
}
