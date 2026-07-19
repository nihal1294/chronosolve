import { describe, expect, it } from "vitest";
import {
  getAdvancedList,
  getTeacherCaps,
  listEntities,
  setTeacherCap,
  upsertEntity,
  type ProblemDoc,
} from "./problem-doc";
import { addSoftened, getSoftened, isSoftened } from "./soften";
import { getTemplate } from "./rule-templates";
import { removeEntityAndRefs } from "./cascade-delete";

const docWith = (advanced: Record<string, unknown>): ProblemDoc => ({ constraints: { advanced } });

describe("removeEntityAndRefs", () => {
  it("removes a teacher plus their daily cap and softened cap ref", () => {
    const doc: ProblemDoc = {
      teachers: [{ id: "t1" }, { id: "t2" }],
      constraints: {
        advanced: {
          hard_teacher_daily_caps: { t1: 4, t2: 5 },
          softened: [{ kind: "teacher_cap", key: "t1" }],
        },
      },
    };
    const next = removeEntityAndRefs(doc, "teachers", "t1");
    expect(listEntities(next, "teachers")).toEqual([{ id: "t2" }]);
    expect(getTeacherCaps(next)).toEqual({ t2: 5 });
    expect(isSoftened(next, "teacher_cap", "t1")).toBe(false);
  });

  it("drops same-day pairs naming the subject and re-keys surviving softened refs", () => {
    const doc = docWith({
      same_day_exclusions: [
        { first: "s1", second: "sX" },
        { first: "s2", second: "s3" },
      ],
      softened: [{ kind: "same_day", key: "1" }],
    });
    const next = removeEntityAndRefs(doc, "subjects", "sX");
    expect(getAdvancedList(next, "same_day_exclusions")).toEqual([{ first: "s2", second: "s3" }]);
    expect(getSoftened(next)).toEqual([{ kind: "same_day", key: "0" }]);
  });

  it("drops every ordering naming the subject, in either position", () => {
    const doc = docWith({
      orderings: [
        { first: "sX", second: "s2" },
        { first: "s3", second: "s4" },
        { first: "s5", second: "sX" },
      ],
    });
    const next = removeEntityAndRefs(doc, "subjects", "sX");
    expect(getAdvancedList(next, "orderings")).toEqual([{ first: "s3", second: "s4" }]);
  });

  it("drops the subject's same-room entry (bare-id list)", () => {
    const doc = docWith({ same_room_subjects: ["s1", "sX", "s2"] });
    const next = removeEntityAndRefs(doc, "subjects", "sX");
    expect(getAdvancedList(next, "same_room_subjects")).toEqual(["s1", "s2"]);
  });

  it("prunes the subject from reservations and drops a reservation left empty", () => {
    const doc = docWith({
      room_reservations: [
        { room_id: "r1", subject_ids: ["sX", "s2"] },
        { room_id: "r2", subject_ids: ["sX"] },
      ],
    });
    const next = removeEntityAndRefs(doc, "subjects", "sX");
    expect(getAdvancedList(next, "room_reservations")).toEqual([{ room_id: "r1", subject_ids: ["s2"] }]);
  });

  it("drops the subject's softened allowed_slots ref", () => {
    const doc = addSoftened(docWith({}), { kind: "allowed_slots", key: "sX" });
    expect(isSoftened(removeEntityAndRefs(doc, "subjects", "sX"), "allowed_slots", "sX")).toBe(false);
  });

  it("drops the subject's pins so pre_assignments never dangle", () => {
    const doc: ProblemDoc = {
      pre_assignments: [
        { subject_id: "sX", day: "Mon", slot: 1 },
        { subject_id: "s2", day: "Tue", slot: 2 },
      ],
    };
    const next = removeEntityAndRefs(doc, "subjects", "sX");
    expect(next.pre_assignments).toEqual([{ subject_id: "s2", day: "Tue", slot: 2 }]);
  });

  it("drops reservations for a deleted room", () => {
    const doc = docWith({
      room_reservations: [
        { room_id: "rX", subject_ids: ["s1"] },
        { room_id: "r2", subject_ids: ["s1"] },
      ],
    });
    const next = removeEntityAndRefs(doc, "rooms", "rX");
    expect(getAdvancedList(next, "room_reservations")).toEqual([{ room_id: "r2", subject_ids: ["s1"] }]);
  });

  it("strips the deleted room off pins but keeps the slot pin itself", () => {
    const doc: ProblemDoc = {
      pre_assignments: [
        { subject_id: "s1", day: "Mon", slot: 1, room_id: "rX" },
        { subject_id: "s2", day: "Tue", slot: 2, room_id: "r2" },
        { subject_id: "s3", day: "Wed", slot: 3 },
      ],
    };
    const next = removeEntityAndRefs(doc, "rooms", "rX");
    expect(next.pre_assignments).toEqual([
      { subject_id: "s1", day: "Mon", slot: 1 },
      { subject_id: "s2", day: "Tue", slot: 2, room_id: "r2" },
      { subject_id: "s3", day: "Wed", slot: 3 },
    ]);
    // No pins name the room -> the doc (and list) come back untouched.
    const untouched = removeEntityAndRefs(next, "rooms", "r9");
    expect(untouched.pre_assignments).toBe(next.pre_assignments);
  });

  it("drops free half-days for a deleted group", () => {
    const doc = docWith({
      group_free_halfdays: [
        { group_id: "gX", day: "Mon", half: "morning" },
        { group_id: "g2", day: "Tue", half: "afternoon" },
      ],
    });
    const next = removeEntityAndRefs(doc, "student_groups", "gX");
    expect(getAdvancedList(next, "group_free_halfdays")).toEqual([
      { group_id: "g2", day: "Tue", half: "afternoon" },
    ]);
  });

  it("deleting an unreferenced entity does not materialize constraints or pins", () => {
    const next = removeEntityAndRefs({ subjects: [{ id: "s1" }] }, "subjects", "s1");
    expect(next.constraints).toBeUndefined();
    expect(next.pre_assignments).toBeUndefined();
  });

  it("a re-added teacher id starts clean: a new cap derives as a hard card", () => {
    let doc: ProblemDoc = { teachers: [{ id: "t1" }] };
    doc = setTeacherCap(doc, "t1", 4);
    doc = addSoftened(doc, { kind: "teacher_cap", key: "t1" });
    doc = removeEntityAndRefs(doc, "teachers", "t1");
    doc = upsertEntity(doc, "teachers", { id: "t1" });
    doc = setTeacherCap(doc, "t1", 6);
    expect(isSoftened(doc, "teacher_cap", "t1")).toBe(false);
    expect(getTemplate("teacher_daily_cap")?.derive(doc)).toEqual([
      { templateId: "teacher_daily_cap", params: { teacher: "t1", cap: 6 } },
    ]);
  });
});
