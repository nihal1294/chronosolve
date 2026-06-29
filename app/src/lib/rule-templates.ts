/** The 12 advanced rule templates (M7.2). Each maps an authored rule to/from the
    canonical M7.1 schema (Option 1: direct mapping). serialize writes an instance
    into the doc; derive reads the config back into instances - the round-trip that
    re-populates the rule cards on file load. Factories live in rule-template-kit. */

import { getTeacherCaps, setTeacherCap } from "./problem-doc";
import {
  entityFieldTemplate,
  globalToggleTemplate,
  listTemplate,
  SUBJECT,
  type RuleTemplate,
} from "./rule-template-kit";

export type {
  ParamDef,
  ParamKind,
  RuleCategory,
  RuleInstance,
  RuleMode,
  RuleTemplate,
} from "./rule-template-kit";

const teacherDailyCap: RuleTemplate = {
  id: "teacher_daily_cap",
  category: "Teacher",
  label: "Cap a teacher at N hours per day",
  mode: "hard",
  params: [
    { key: "teacher", label: "Teacher", kind: "teacher" },
    { key: "cap", label: "Max hours per day", kind: "number" },
  ],
  serialize: (instance, doc) =>
    setTeacherCap(doc, instance.params.teacher as string, instance.params.cap as number),
  derive: (doc) =>
    Object.entries(getTeacherCaps(doc)).map(([teacher, cap]) => ({
      templateId: "teacher_daily_cap",
      params: { teacher, cap },
    })),
  remove: (doc, index) => {
    // derive() and remove() iterate the SAME caps object (entries vs keys) and
    // js-yaml preserves insertion order, so the card's index maps back to the
    // intended teacher key.
    const teacher = Object.keys(getTeacherCaps(doc))[index];
    return teacher ? setTeacherCap(doc, teacher, null) : doc;
  },
};

export const RULE_TEMPLATES: RuleTemplate[] = [
  listTemplate({
    id: "no_classes_break",
    category: "Time",
    label: "No classes for anyone on a day at given slots",
    mode: "hard",
    params: [
      { key: "day", label: "Day", kind: "day" },
      { key: "slots", label: "Slots", kind: "slots" },
    ],
    listKey: "global_breaks",
    toEntry: (p) => ({ day: p.day, slots: p.slots }),
    fromEntry: (e) => ({ day: e.day, slots: e.slots }),
  }),
  entityFieldTemplate({
    id: "subject_allowed_slots",
    category: "Time",
    label: "A subject may only run at given slots",
    section: "subjects",
    field: "allowed_slots",
    idParam: SUBJECT("subject", "Subject"),
    valueParam: { key: "slots", label: "Allowed slots", kind: "slots" },
  }),
  teacherDailyCap,
  listTemplate({
    id: "group_free_halfday",
    category: "Group",
    label: "Give a group a free half-day",
    mode: "soft",
    params: [
      { key: "group", label: "Group", kind: "group" },
      { key: "day", label: "Day", kind: "day" },
      { key: "half", label: "Half-day", kind: "half" },
    ],
    listKey: "group_free_halfdays",
    weightKey: "group_free_halfday",
    toEntry: (p) => ({ group_id: p.group, day: p.day, half: p.half }),
    fromEntry: (e) => ({ group: e.group_id, day: e.day, half: e.half }),
  }),
  entityFieldTemplate({
    id: "subject_required_tags",
    category: "Subject",
    label: "A subject needs a room with given tags",
    section: "subjects",
    field: "required_tags",
    idParam: SUBJECT("subject", "Subject"),
    valueParam: { key: "tags", label: "Required tags", kind: "tags" },
  }),
  listTemplate({
    id: "subjects_not_same_day",
    category: "Subject",
    label: "Two subjects never on the same day",
    mode: "hard",
    params: [SUBJECT("a", "First subject"), SUBJECT("b", "Second subject")],
    listKey: "same_day_exclusions",
    toEntry: (p) => ({ first: p.a, second: p.b }),
    fromEntry: (e) => ({ a: e.first, b: e.second }),
  }),
  listTemplate({
    id: "subject_order",
    category: "Subject",
    label: "One subject must run before another",
    mode: "hard",
    params: [SUBJECT("a", "Earlier subject"), SUBJECT("b", "Later subject")],
    listKey: "orderings",
    toEntry: (p) => ({ first: p.a, second: p.b }),
    fromEntry: (e) => ({ a: e.first, b: e.second }),
  }),
  listTemplate({
    id: "room_reservation",
    category: "Room",
    label: "Reserve a room for given subjects only",
    mode: "hard",
    params: [
      { key: "room", label: "Room", kind: "room" },
      { key: "subjects", label: "Subjects", kind: "subjects" },
    ],
    listKey: "room_reservations",
    toEntry: (p) => ({ room_id: p.room, subject_ids: p.subjects }),
    fromEntry: (e) => ({ room: e.room_id, subjects: e.subject_ids }),
  }),
  globalToggleTemplate({
    id: "room_capacity",
    category: "Room",
    label: "Every class fits in its room (seats >= group size)",
    mode: "hard",
    hardFlag: "room_capacity",
  }),
  listTemplate({
    id: "subject_same_room",
    category: "Room",
    label: "A subject uses the same room all week",
    mode: "soft",
    params: [SUBJECT("subject", "Subject")],
    listKey: "same_room_subjects",
    weightKey: "same_room",
    // same_room_subjects is a list[str] in the backend (models/rules.py:81), so
    // unlike the other list rules the entry is a bare subject-id string, not an
    // object. Keep it that way - it stays CLI-solvable; index-based removal works.
    toEntry: (p) => p.subject,
    fromEntry: (e) => ({ subject: e }),
  }),
  globalToggleTemplate({
    id: "avoid_consecutive_labs",
    category: "Fairness",
    label: "Avoid back-to-back labs for groups",
    mode: "soft",
    weightKey: "avoid_consecutive_labs",
  }),
  globalToggleTemplate({
    id: "group_workload_balance",
    category: "Fairness",
    label: "Balance daily load across the week for groups",
    mode: "soft",
    weightKey: "group_workload_balance",
  }),
];

const BY_ID = new Map(RULE_TEMPLATES.map((t) => [t.id, t]));

/** Look up a template by id (undefined when unknown). */
export function getTemplate(id: string): RuleTemplate | undefined {
  return BY_ID.get(id);
}
