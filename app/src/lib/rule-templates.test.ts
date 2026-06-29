import { describe, expect, it } from "vitest";
import { RULE_TEMPLATES, getTemplate, type RuleInstance, type RuleTemplate } from "./rule-templates";
import { parseDoc, serializeDoc, upsertEntity, type EntitySection, type ProblemDoc } from "./problem-doc";

/** A doc seeded with the entities a rule references (the real precondition for
    authoring it), so per-entity serialize - a no-op on unknown ids - applies. */
function seedDoc(template: RuleTemplate, sample: RuleInstance): ProblemDoc {
  let doc: ProblemDoc = {};
  const add = (section: EntitySection, id: unknown) => {
    doc = upsertEntity(doc, section, { id: id as string });
  };
  for (const param of template.params) {
    const value = sample.params[param.key];
    if (param.kind === "subject") add("subjects", value);
    else if (param.kind === "teacher") add("teachers", value);
    else if (param.kind === "group") add("student_groups", value);
    else if (param.kind === "room") add("rooms", value);
    else if (param.kind === "subjects") for (const id of value as unknown[]) add("subjects", id);
  }
  return doc;
}

/** One representative authored instance per template, for the round-trip contract. */
const SAMPLES: Record<string, RuleInstance> = {
  no_classes_break: { templateId: "no_classes_break", params: { day: "Monday", slots: [4] } },
  subject_allowed_slots: {
    templateId: "subject_allowed_slots",
    params: { subject: "math", slots: [1, 2, 3] },
  },
  teacher_daily_cap: { templateId: "teacher_daily_cap", params: { teacher: "t1", cap: 4 } },
  group_free_halfday: {
    templateId: "group_free_halfday",
    params: { group: "g1", day: "Tuesday", half: "morning" },
  },
  subject_required_tags: { templateId: "subject_required_tags", params: { subject: "ml", tags: ["gpu"] } },
  subjects_not_same_day: { templateId: "subjects_not_same_day", params: { a: "pe", b: "chem" } },
  subject_order: { templateId: "subject_order", params: { a: "lecture", b: "lab" } },
  room_reservation: { templateId: "room_reservation", params: { room: "lab1", subjects: ["bio"] } },
  room_capacity: { templateId: "room_capacity", params: {} },
  subject_same_room: { templateId: "subject_same_room", params: { subject: "art" } },
  avoid_consecutive_labs: { templateId: "avoid_consecutive_labs", params: {} },
  group_workload_balance: { templateId: "group_workload_balance", params: {} },
};

describe("rule-templates registry", () => {
  it("covers all 12 advanced rules with unique ids and a sample each", () => {
    expect(RULE_TEMPLATES).toHaveLength(12);
    const ids = RULE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(12);
    for (const id of ids) expect(SAMPLES[id], `missing sample for ${id}`).toBeDefined();
  });

  it("getTemplate returns the matching template or undefined", () => {
    expect(getTemplate("subject_order")?.id).toBe("subject_order");
    expect(getTemplate("nope")).toBeUndefined();
  });

  it("soft templates carry a weightKey, hard templates do not", () => {
    for (const t of RULE_TEMPLATES) {
      if (t.mode === "soft") expect(t.weightKey, `${t.id} needs a weightKey`).toBeTruthy();
      else expect(t.weightKey).toBeUndefined();
    }
  });

  for (const template of RULE_TEMPLATES) {
    it(`round-trips ${template.id} through serialize -> derive`, () => {
      const sample = SAMPLES[template.id];
      expect(template.derive(template.serialize(sample, seedDoc(template, sample)))).toEqual([sample]);
    });

    it(`${template.id} survives a YAML round-trip`, () => {
      const sample = SAMPLES[template.id];
      const doc = parseDoc(serializeDoc(template.serialize(sample, seedDoc(template, sample))));
      expect(template.derive(doc)).toEqual([sample]);
    });

    it(`remove undoes ${template.id}`, () => {
      const sample = SAMPLES[template.id];
      const doc = template.serialize(sample, seedDoc(template, sample));
      expect(template.derive(template.remove(doc, 0))).toEqual([]);
    });
  }
});
