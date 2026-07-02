/** The 5 soften-companion templates (M7.3): a softened hard rule renders as a
    tunable soft card in Advanced rules. Kept OUT of RULE_TEMPLATES on purpose -
    AddRuleMenu authors from that registry, and these are never authored: they
    exist only via the panel's "Soften to preference" (addSoftened). remove
    deletes the rule outright: the softened ref AND the underlying instance. */

import {
  getAdvancedList,
  getTeacherCaps,
  listEntities,
  setEntityField,
  setTeacherCap,
  type ProblemDoc,
} from "./problem-doc";
import { SUBJECT } from "./rule-template-kit";
import type { ParamDef, RuleCategory, RuleTemplate } from "./rule-template-types";
import { isSoftened, removeIndexKeyedRule, removeSoftened, softenedIndex, weightKeyFor } from "./soften";

type Params = Record<string, unknown>;

/** Soft card over the softened entries of one index-keyed list rule. */
function softenedListTemplate(spec: {
  id: string;
  kind: string;
  listKey: string;
  category: RuleCategory;
  label: string;
  params: ParamDef[];
  fromEntry: (entry: Params) => Params;
}): RuleTemplate {
  return {
    id: spec.id,
    category: spec.category,
    label: spec.label,
    mode: "soft",
    params: spec.params,
    weightKey: weightKeyFor(spec.kind),
    serialize: (_instance, doc) => doc, // soften-action only; never authored
    derive: (doc) =>
      getAdvancedList(doc, spec.listKey).flatMap((entry, i) =>
        isSoftened(doc, spec.kind, String(i))
          ? [{ templateId: spec.id, params: spec.fromEntry(entry as Params) }]
          : [],
      ),
    remove: (doc, index) => {
      const original = softenedIndex(doc, spec.listKey, spec.kind, index);
      return original === -1 ? doc : removeIndexKeyedRule(doc, spec.listKey, spec.kind, original);
    },
  };
}

const softenedSubjects = (doc: ProblemDoc) =>
  listEntities(doc, "subjects")
    .filter((e) => Array.isArray(e.allowed_slots) && e.allowed_slots.length > 0)
    .filter((e) => isSoftened(doc, "allowed_slots", e.id));

const softenedAllowedSlots: RuleTemplate = {
  id: "softened_allowed_slots",
  category: "Time",
  label: "Prefer a subject at its chosen slots",
  mode: "soft",
  params: [SUBJECT("subject", "Subject"), { key: "slots", label: "Preferred slots", kind: "slots" }],
  weightKey: weightKeyFor("allowed_slots"),
  serialize: (_instance, doc) => doc,
  derive: (doc) =>
    softenedSubjects(doc).map((e) => ({
      templateId: "softened_allowed_slots",
      params: { subject: e.id, slots: e.allowed_slots },
    })),
  remove: (doc, index) => {
    const target = softenedSubjects(doc)[index];
    if (!target) return doc;
    const cleared = setEntityField(doc, "subjects", target.id, "allowed_slots", undefined);
    return removeSoftened(cleared, { kind: "allowed_slots", key: target.id });
  },
};

const softenedCapKeys = (doc: ProblemDoc) =>
  Object.keys(getTeacherCaps(doc)).filter((tid) => isSoftened(doc, "teacher_cap", tid));

const softenedTeacherCap: RuleTemplate = {
  id: "softened_teacher_cap",
  category: "Teacher",
  label: "Prefer a teacher under N hours per day",
  mode: "soft",
  params: [
    { key: "teacher", label: "Teacher", kind: "teacher" },
    { key: "cap", label: "Preferred max hours per day", kind: "number" },
  ],
  weightKey: weightKeyFor("teacher_cap"),
  serialize: (_instance, doc) => doc,
  derive: (doc) =>
    softenedCapKeys(doc).map((teacher) => ({
      templateId: "softened_teacher_cap",
      params: { teacher, cap: getTeacherCaps(doc)[teacher] },
    })),
  remove: (doc, index) => {
    const teacher = softenedCapKeys(doc)[index];
    if (!teacher) return doc;
    return removeSoftened(setTeacherCap(doc, teacher, null), { kind: "teacher_cap", key: teacher });
  },
};

/** Derived-only registry; concatenated with RULE_TEMPLATES by AdvancedRulesSection. */
export const SOFTENED_TEMPLATES: RuleTemplate[] = [
  softenedListTemplate({
    id: "softened_break",
    kind: "break",
    listKey: "global_breaks",
    category: "Time",
    label: "Prefer no classes on a day at given slots",
    params: [
      { key: "day", label: "Day", kind: "day" },
      { key: "slots", label: "Slots", kind: "slots" },
    ],
    fromEntry: (e) => ({ day: e.day, slots: e.slots }),
  }),
  softenedAllowedSlots,
  softenedTeacherCap,
  softenedListTemplate({
    id: "softened_same_day",
    kind: "same_day",
    listKey: "same_day_exclusions",
    category: "Subject",
    label: "Prefer two subjects on different days",
    params: [SUBJECT("a", "First subject"), SUBJECT("b", "Second subject")],
    fromEntry: (e) => ({ a: e.first, b: e.second }),
  }),
  softenedListTemplate({
    id: "softened_ordering",
    kind: "ordering",
    listKey: "orderings",
    category: "Subject",
    label: "Prefer one subject before another",
    params: [SUBJECT("a", "Earlier subject"), SUBJECT("b", "Later subject")],
    fromEntry: (e) => ({ a: e.first, b: e.second }),
  }),
];
