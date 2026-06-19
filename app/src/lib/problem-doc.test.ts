import { describe, expect, it } from "vitest";
import {
  getHardFlag,
  getSoftWeight,
  parseDoc,
  pinAssignment,
  removeEntity,
  serializeDoc,
  setHardFlag,
  setSoftWeight,
  unpinAssignment,
  upsertEntity,
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
