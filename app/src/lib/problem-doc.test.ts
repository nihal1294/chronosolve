import { describe, expect, it } from "vitest";
import {
  appendAdvancedItem,
  getAdvancedList,
  getHardFlag,
  getSoftWeight,
  getTeacherCaps,
  listEntities,
  parseDoc,
  pinAssignment,
  removeAdvancedItem,
  removeEntity,
  serializeDoc,
  setEntityField,
  setHardFlag,
  setSoftWeight,
  setTeacherCap,
  unpinAssignment,
  upsertEntity,
  type ProblemDoc,
} from "./problem-doc";

const YAML = `
time_structure:
  days: [Monday, Tuesday]
  slots_per_day: 4
teachers:
  - id: t1
    name: Dr. One
subjects:
  - id: math
    hours_per_week: 3
    teacher_ids: [t1]
    custom_field: keep-me
constraints:
  soft:
    minimize_student_gaps: 80
totally_unknown_section:
  nested: [1, 2, 3]
`;

describe("parseDoc / serializeDoc", () => {
  it("round-trips untouched fields, including unknown ones", () => {
    const doc = parseDoc(YAML);
    const updated = upsertEntity(doc, "rooms", { id: "r1", capacity: 40 });
    const reparsed = parseDoc(serializeDoc(updated));
    expect(reparsed.totally_unknown_section).toEqual({ nested: [1, 2, 3] });
    expect((reparsed.subjects as Record<string, unknown>[])[0].custom_field).toBe("keep-me");
    expect(reparsed.time_structure).toEqual({ days: ["Monday", "Tuesday"], slots_per_day: 4 });
    expect(reparsed.rooms).toEqual([{ id: "r1", capacity: 40 }]);
  });

  it("parses empty text to an empty doc and rejects non-mapping documents", () => {
    expect(parseDoc("")).toEqual({});
    expect(() => parseDoc("- just\n- a list\n")).toThrow(/mapping/i);
  });
});

describe("upsertEntity", () => {
  it("appends a new entity, creating the section when missing", () => {
    const doc = parseDoc(YAML);
    const updated = upsertEntity(doc, "rooms", { id: "r1" });
    expect(updated.rooms).toEqual([{ id: "r1" }]);
  });

  it("replaces an existing entity by id, preserving its position", () => {
    const doc = upsertEntity(parseDoc(YAML), "teachers", { id: "t2", name: "Dr. Two" });
    const updated = upsertEntity(doc, "teachers", { id: "t1", name: "Dr. Renamed" });
    expect(updated.teachers).toEqual([
      { id: "t1", name: "Dr. Renamed" },
      { id: "t2", name: "Dr. Two" },
    ]);
  });

  it("never mutates the input doc", () => {
    const doc = parseDoc(YAML);
    const before = JSON.parse(JSON.stringify(doc));
    upsertEntity(doc, "subjects", { id: "math", hours_per_week: 9 });
    removeEntity(doc, "teachers", "t1");
    setSoftWeight(doc, "free_days", 10);
    expect(doc).toEqual(before);
  });
});

describe("removeEntity", () => {
  it("removes by id and tolerates missing sections", () => {
    const doc = parseDoc(YAML);
    expect(removeEntity(doc, "teachers", "t1").teachers).toEqual([]);
    expect(removeEntity(doc, "rooms", "ghost").rooms ?? []).toEqual([]);
  });
});

describe("constraints helpers", () => {
  it("sets hard flags and soft weights, creating the paths when missing", () => {
    const doc = parseDoc("subjects: []");
    const withHard = setHardFlag(doc, "room_no_clash", false);
    const withSoft = setSoftWeight(withHard, "free_days", 55);
    const constraints = withSoft.constraints as Record<string, Record<string, unknown>>;
    expect(constraints.hard.room_no_clash).toBe(false);
    expect(constraints.soft.free_days).toBe(55);
  });

  it("updates existing weights without dropping siblings", () => {
    const updated = setSoftWeight(parseDoc(YAML), "minimize_student_gaps", 5);
    const constraints = updated.constraints as Record<string, Record<string, unknown>>;
    expect(constraints.soft.minimize_student_gaps).toBe(5);
  });
});

describe("pinAssignment / unpinAssignment", () => {
  const pin = { subjectId: "math", day: "Monday", slot: 2 };
  const entry = { subject_id: "math", day: "Monday", slot: 2 };

  it("pins by appending a pre_assignments entry, exactly once", () => {
    const doc = parseDoc(YAML);
    const pinned = pinAssignment(doc, pin);
    expect(pinned.pre_assignments).toEqual([entry]);
    expect(pinAssignment(pinned, pin).pre_assignments).toEqual([entry]);
    expect(doc.pre_assignments).toBeUndefined(); // input untouched
  });

  it("unpins only the exact (subject, day, slot) match", () => {
    const other = { subject_id: "math", day: "Tuesday", slot: 1 };
    const doc = { pre_assignments: [entry, other, "malformed"] };
    const unpinned = unpinAssignment(doc, pin);
    expect(unpinned.pre_assignments).toEqual([other, "malformed"]);
    expect(unpinAssignment(parseDoc(YAML), pin).pre_assignments).toBeUndefined();
  });
});

describe("constraint readers", () => {
  it("getHardFlag falls back when unset and reads a stored flag", () => {
    expect(getHardFlag({}, "room_no_clash", true)).toBe(true);
    const doc = setHardFlag({}, "room_no_clash", false);
    expect(getHardFlag(doc, "room_no_clash", true)).toBe(false);
  });

  it("getSoftWeight is 0 when unset and reads a stored weight", () => {
    expect(getSoftWeight({}, "workload_balance")).toBe(0);
    const doc = setSoftWeight({}, "workload_balance", 75);
    expect(getSoftWeight(doc, "workload_balance")).toBe(75);
  });
});

describe("advanced-constraint accessors", () => {
  it("appends to and reads an advanced list", () => {
    const doc = appendAdvancedItem({}, "same_day_exclusions", { first: "a", second: "b" });
    expect(getAdvancedList(doc, "same_day_exclusions")).toEqual([{ first: "a", second: "b" }]);
  });

  it("appends preserve earlier items and sibling advanced keys", () => {
    let doc = appendAdvancedItem({}, "orderings", { first: "x", second: "y" });
    doc = appendAdvancedItem(doc, "orderings", { first: "p", second: "q" });
    doc = appendAdvancedItem(doc, "global_breaks", { day: "Monday", slots: [1] });
    expect(getAdvancedList(doc, "orderings")).toHaveLength(2);
    expect(getAdvancedList(doc, "global_breaks")).toEqual([{ day: "Monday", slots: [1] }]);
  });

  it("removes an advanced item by index, leaving the rest", () => {
    let doc = appendAdvancedItem({}, "same_room_subjects", "math");
    doc = appendAdvancedItem(doc, "same_room_subjects", "physics");
    expect(getAdvancedList(removeAdvancedItem(doc, "same_room_subjects", 0), "same_room_subjects")).toEqual([
      "physics",
    ]);
  });

  it("removeAdvancedItem out of range is a no-op", () => {
    const doc = appendAdvancedItem({}, "orderings", { first: "a", second: "b" });
    expect(getAdvancedList(removeAdvancedItem(doc, "orderings", 5), "orderings")).toHaveLength(1);
  });

  it("getAdvancedList is [] for a missing or malformed key", () => {
    expect(getAdvancedList({}, "global_breaks")).toEqual([]);
    const bad = { constraints: { advanced: { global_breaks: "nope" } } };
    expect(getAdvancedList(bad, "global_breaks")).toEqual([]);
  });

  it("sets and clears a hard teacher daily cap", () => {
    let doc = setTeacherCap({}, "t1", 4);
    expect(getTeacherCaps(doc)).toEqual({ t1: 4 });
    doc = setTeacherCap(doc, "t2", 3);
    expect(getTeacherCaps(doc)).toEqual({ t1: 4, t2: 3 });
    doc = setTeacherCap(doc, "t1", null);
    expect(getTeacherCaps(doc)).toEqual({ t2: 3 });
  });

  it("editing caps preserves sibling advanced lists", () => {
    let doc = appendAdvancedItem({}, "orderings", { first: "a", second: "b" });
    doc = setTeacherCap(doc, "t1", 4);
    expect(getAdvancedList(doc, "orderings")).toHaveLength(1);
    expect(getTeacherCaps(doc)).toEqual({ t1: 4 });
  });

  it("sets a field on one entity, leaving siblings untouched", () => {
    const base = {
      subjects: [
        { id: "math", hours_per_week: 3 },
        { id: "art", hours_per_week: 2 },
      ],
    };
    const doc = setEntityField(base, "subjects", "math", "allowed_slots", [1, 2, 3]);
    expect(listEntities(doc, "subjects")[0]).toEqual({
      id: "math",
      hours_per_week: 3,
      allowed_slots: [1, 2, 3],
    });
    expect(listEntities(doc, "subjects")[1]).toEqual({ id: "art", hours_per_week: 2 });
  });

  it("clears an entity field when the value is undefined", () => {
    const base = { subjects: [{ id: "math", required_tags: ["gpu"] }] };
    const doc = setEntityField(base, "subjects", "math", "required_tags", undefined);
    expect(listEntities(doc, "subjects")[0]).toEqual({ id: "math" });
  });

  it("setEntityField is a no-op for an unknown entity", () => {
    const base = { subjects: [{ id: "math" }] };
    expect(setEntityField(base, "subjects", "ghost", "allowed_slots", [1])).toEqual(base);
  });

  it("advanced fields survive a YAML round-trip", () => {
    let doc: ProblemDoc = appendAdvancedItem({}, "same_day_exclusions", { first: "a", second: "b" });
    doc = setTeacherCap(doc, "t1", 4);
    doc = setEntityField({ ...doc, subjects: [{ id: "math" }] }, "subjects", "math", "allowed_slots", [1, 2]);
    const reparsed = parseDoc(serializeDoc(doc));
    expect(getAdvancedList(reparsed, "same_day_exclusions")).toEqual([{ first: "a", second: "b" }]);
    expect(getTeacherCaps(reparsed)).toEqual({ t1: 4 });
    expect(listEntities(reparsed, "subjects")[0]).toEqual({ id: "math", allowed_slots: [1, 2] });
  });
});
