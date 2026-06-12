import { describe, expect, it } from "vitest";
import { ENTITY_FIELDS, entityToForm, formToEntity, sectionForKind } from "./entity-forms";

const SUBJECT_FIELDS = ENTITY_FIELDS.subjects;
const TEACHER_FIELDS = ENTITY_FIELDS.teachers;
const NO_IDS = { base: null, existingIds: [] as string[] };

describe("sectionForKind", () => {
  it("maps the sidebar's groups kind to the student_groups section", () => {
    expect(sectionForKind("groups")).toBe("student_groups");
    expect(sectionForKind("subjects")).toBe("subjects");
  });
});

describe("formToEntity", () => {
  it("maps subject inputs to a snake_case entity, dropping cleared optionals", () => {
    const { entity, errors } = formToEntity(
      SUBJECT_FIELDS,
      {
        id: " DAA ",
        name: "Algorithms",
        hours_per_week: "4",
        type: "theory",
        teacher_ids: ["t1"],
        group_ids: ["g1", "g2"],
        max_per_day: "",
        consecutive_hours: "",
        preferred_room_type: "",
      },
      NO_IDS,
    );
    expect(errors).toEqual({});
    expect(entity).toEqual({
      id: "DAA",
      name: "Algorithms",
      hours_per_week: 4,
      type: "theory",
      teacher_ids: ["t1"],
      group_ids: ["g1", "g2"],
    });
  });

  it("collects per-field errors: required blanks, bad ints, empty id lists, duplicate ids", () => {
    const { entity, errors } = formToEntity(
      SUBJECT_FIELDS,
      { id: "DAA", name: "", hours_per_week: "0", type: "theory", teacher_ids: [], group_ids: ["g1"] },
      { base: null, existingIds: ["DAA"] },
    );
    expect(entity).toBeNull();
    expect(errors.name).toBe("Required");
    expect(errors.hours_per_week).toMatch(/positive/);
    expect(errors.teacher_ids).toMatch(/at least one/);
    expect(errors.id).toMatch(/already exists/);
  });

  it("preserves unknown keys from the base entity and clears emptied ones", () => {
    const base = { id: "t1", name: "Dr. One", unavailable: { Monday: [1] }, custom: "keep-me" };
    const { entity } = formToEntity(
      TEACHER_FIELDS,
      { id: "t1", name: "Dr. Renamed", unavailable: { Monday: "" } },
      { base, existingIds: ["t1"] },
    );
    expect(entity).toEqual({ id: "t1", name: "Dr. Renamed", custom: "keep-me" });
  });

  it("parses unavailable day inputs into slot-number lists and flags junk", () => {
    const good = formToEntity(
      TEACHER_FIELDS,
      { id: "t1", name: "Dr. One", unavailable: { Monday: "1, 3", Friday: " 6 " } },
      NO_IDS,
    );
    expect(good.entity?.unavailable).toEqual({ Monday: [1, 3], Friday: [6] });

    const bad = formToEntity(
      TEACHER_FIELDS,
      { id: "t1", name: "Dr. One", unavailable: { Monday: "1, x" } },
      NO_IDS,
    );
    expect(bad.entity).toBeNull();
    expect(bad.errors.unavailable).toMatch(/Monday/);
  });
});

describe("entityToForm", () => {
  it("seeds inputs from an entity and round-trips through formToEntity", () => {
    const entity = {
      id: "OS-LAB",
      name: "OS Lab",
      hours_per_week: 3,
      type: "lab",
      teacher_ids: ["t2"],
      group_ids: ["g1"],
      consecutive_hours: 3,
    };
    const values = entityToForm(SUBJECT_FIELDS, entity);
    expect(values.hours_per_week).toBe("3");
    expect(values.max_per_day).toBe("");
    expect(values.teacher_ids).toEqual(["t2"]);

    const back = formToEntity(SUBJECT_FIELDS, values, { base: entity, existingIds: ["OS-LAB"] });
    expect(back.entity).toEqual(entity);
  });

  it("renders unavailable maps as comma lists and blanks for create mode", () => {
    const values = entityToForm(TEACHER_FIELDS, { id: "t1", unavailable: { Monday: [1, 2] } });
    expect(values.unavailable).toEqual({ Monday: "1, 2" });
    expect(entityToForm(TEACHER_FIELDS, null)).toEqual({ id: "", name: "", unavailable: {} });
  });

  it("seeds selects with their first option so display and saved value agree", () => {
    expect(entityToForm(ENTITY_FIELDS.rooms, null).type).toBe("any");
    expect(entityToForm(SUBJECT_FIELDS, null).type).toBe("theory");
    expect(entityToForm(SUBJECT_FIELDS, null).preferred_room_type).toBe("");
  });
});
