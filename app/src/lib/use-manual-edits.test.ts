import { describe, expect, it } from "vitest";
import { activeMoves, appendMove, type MoveState } from "./use-manual-edits";
import { applyOverrides } from "./overrides";
import { buildConflictInputs } from "./conflict-model";
import { findConflicts } from "./conflicts";
import type { ScheduleEntry } from "./solver-client";

const entry = (subject: string, day: string, slot: number, teachers = ["t1"]): ScheduleEntry => ({
  subject_id: subject,
  day,
  slot,
  teacher_ids: teachers,
  group_ids: [subject === "eng" ? "g2" : "g1"],
  room_id: null,
});

const NO_BLOCKS = new Map<string, number>();

describe("activeMoves", () => {
  const schedule = [entry("math", "Mon", 1)];
  const moves: MoveState["moves"] = [
    { kind: "move", subjectId: "math", from: { day: "Mon", slot: 1 }, to: { day: "Tue", slot: 2 } },
  ];

  it("is empty before any edit", () => {
    expect(activeMoves(null, schedule)).toEqual([]);
  });

  it("returns the moves recorded against the current schedule", () => {
    expect(activeMoves({ base: schedule, moves }, schedule)).toBe(moves);
  });

  it("drops edits when a new solve replaces the base schedule", () => {
    const fresh = [entry("math", "Tue", 3)];
    expect(activeMoves({ base: schedule, moves }, fresh)).toEqual([]);
  });
});

describe("appendMove", () => {
  it("records a move anchored at the entry's own slot for single-slot subjects", () => {
    const display = [entry("math", "Mon", 1)];
    const next = appendMove([], display, display[0], { day: "Tue", slot: 3 }, NO_BLOCKS);
    expect(next).toEqual([
      { kind: "move", subjectId: "math", from: { day: "Mon", slot: 1 }, to: { day: "Tue", slot: 3 } },
    ]);
  });

  it("anchors block subjects: dragging any covered slot moves the whole block", () => {
    const blocks = new Map([["lab", 2]]);
    const display = [entry("lab", "Mon", 1), entry("lab", "Mon", 2)];
    const next = appendMove([], display, display[1], { day: "Tue", slot: 1 }, blocks);
    expect(next).toEqual([
      { kind: "move", subjectId: "lab", from: { day: "Mon", slot: 1 }, to: { day: "Tue", slot: 1 } },
    ]);
    expect(applyOverrides(display, next, blocks)).toEqual([entry("lab", "Tue", 1), entry("lab", "Tue", 2)]);
  });

  it("ignores a drop onto the block's own anchor", () => {
    const display = [entry("math", "Mon", 1)];
    const moves = appendMove([], display, display[0], { day: "Mon", slot: 1 }, NO_BLOCKS);
    expect(moves).toEqual([]);
  });
});

describe("move -> conflict composition (the drag-and-see-what-breaks contract)", () => {
  const doc = {
    time_structure: { days: ["Mon", "Tue"], slots_per_day: 4 },
    teachers: [{ id: "t1", name: "A" }],
    student_groups: [
      { id: "g1", name: "G1", size: 30 },
      { id: "g2", name: "G2", size: 25 },
    ],
    subjects: [
      { id: "math", name: "M", hours_per_week: 1, teacher_ids: ["t1"], group_ids: ["g1"] },
      { id: "eng", name: "E", hours_per_week: 1, teacher_ids: ["t1"], group_ids: ["g2"] },
    ],
  };

  it("flags a teacher double-book after moving math onto eng's slot", () => {
    const base = [entry("math", "Mon", 1), entry("eng", "Mon", 2)];
    const moves = appendMove([], base, base[0], { day: "Mon", slot: 2 }, NO_BLOCKS);
    const display = applyOverrides(base, moves, NO_BLOCKS);
    const conflicts = findConflicts(buildConflictInputs(doc), display);
    expect(conflicts.map((c) => c.kind)).toEqual(["teacher-double-book"]);
    expect(new Set(conflicts[0].entryKeys)).toEqual(new Set(["math|Mon|2", "eng|Mon|2"]));
  });
});
