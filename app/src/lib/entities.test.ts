import { describe, expect, it } from "vitest";
import { load as parseYaml } from "js-yaml";
import { parseEntities } from "./entities";

const TEMPLATE_LIKE = `
time_structure:
  days: [Monday, Tuesday]
  slots_per_day: 6
  slot_labels:
    1: "9:00 - 9:55"
    2: "10:00 - 10:55"
teachers:
  - id: t_smith
    name: Dr. Smith
    unavailable:
      Friday: [5, 6]
student_groups:
  - id: sec_a
    name: Section A
    size: 40
rooms:
  - id: r101
    capacity: 50
    type: lecture
subjects:
  - id: math
    name: Mathematics
    hours_per_week: 4
    teacher_ids: [t_smith]
    group_ids: [sec_a]
  - id: sci_lab
    hours_per_week: 2
    type: lab
    teacher_ids: [t_smith]
    group_ids: [sec_a]
pre_assignments:
  - subject_id: math
    day: Monday
    slot: 1
`;

describe("parseEntities", () => {
  it("extracts rows, axis data, and labels from a template-shaped document", () => {
    const entities = parseEntities(parseYaml(TEMPLATE_LIKE));
    expect(entities.subjects.map((subject) => subject.id)).toEqual(["math", "sci_lab"]);
    expect(entities.subjects[0]).toMatchObject({
      name: "Mathematics",
      hoursPerWeek: 4,
      teacherIds: ["t_smith"],
      groupIds: ["sec_a"],
      kind: "lecture",
    });
    expect(entities.subjects[1].kind).toBe("lab");
    expect(entities.teachers[0]).toMatchObject({ name: "Dr. Smith", unavailable: "Friday 5,6" });
    expect(entities.groups[0]).toMatchObject({ name: "Section A", size: 40 });
    expect(entities.days).toEqual(["Monday", "Tuesday"]);
    expect(entities.slotsPerDay).toBe(6);
    expect(entities.slotLabels[1]).toBe("9:00 - 9:55");
    expect(entities.preAssignments).toEqual([{ subjectId: "math", day: "Monday", slot: 1 }]);
  });

  it("falls back to the id when a name is missing", () => {
    const entities = parseEntities(parseYaml(TEMPLATE_LIKE));
    expect(entities.rooms[0].name).toBe("r101");
    expect(entities.subjects[1].name).toBe("sci_lab");
  });

  it("returns empty summaries for malformed or empty documents", () => {
    for (const doc of [null, undefined, 42, "text", { subjects: "nope" }]) {
      const entities = parseEntities(doc);
      expect(entities.subjects).toEqual([]);
      expect(entities.teachers).toEqual([]);
      expect(entities.preAssignments).toEqual([]);
      expect(entities.days).toEqual([]);
    }
  });
});
