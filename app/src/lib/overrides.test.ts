import { describe, expect, it } from "vitest";
import { applyOverrides, overridesToPreAssignments, type ManualOverride } from "./overrides";
import type { ScheduleEntry } from "./solver-client";

const entry = (subject: string, day: string, slot: number, room: string | null = null): ScheduleEntry => ({
  subject_id: subject,
  day,
  slot,
  teacher_ids: ["t1"],
  group_ids: ["g1"],
  room_id: room,
});

const move = (subject: string, from: [string, number], to: [string, number]): ManualOverride => ({
  kind: "move",
  subjectId: subject,
  from: { day: from[0], slot: from[1] },
  to: { day: to[0], slot: to[1] },
});

const NO_BLOCKS = new Map<string, number>();

describe("applyOverrides", () => {
  it("moves a single-slot session and preserves its people and room", () => {
    const schedule = [entry("math", "Mon", 1, "r1"), entry("eng", "Mon", 2)];
    const next = applyOverrides(schedule, [move("math", ["Mon", 1], ["Tue", 3])], NO_BLOCKS);
    expect(next).toContainEqual(entry("math", "Tue", 3, "r1"));
    expect(next).toContainEqual(entry("eng", "Mon", 2));
    expect(next).toHaveLength(2);
  });

  it("moves a block as a whole: every covered slot shifts with the anchor", () => {
    const blocks = new Map([["lab", 2]]);
    const schedule = [entry("lab", "Mon", 1, "r2"), entry("lab", "Mon", 2, "r2")];
    const next = applyOverrides(schedule, [move("lab", ["Mon", 1], ["Wed", 3])], blocks);
    expect(next).toContainEqual(entry("lab", "Wed", 3, "r2"));
    expect(next).toContainEqual(entry("lab", "Wed", 4, "r2"));
    expect(next).toHaveLength(2);
  });

  it("ignores a stale override whose source block is gone", () => {
    const schedule = [entry("math", "Mon", 1)];
    const next = applyOverrides(schedule, [move("math", ["Fri", 4], ["Tue", 1])], NO_BLOCKS);
    expect(next).toEqual(schedule);
  });

  it("chains overrides in order: a second move starts from the first's result", () => {
    const schedule = [entry("math", "Mon", 1)];
    const next = applyOverrides(
      schedule,
      [move("math", ["Mon", 1], ["Tue", 2]), move("math", ["Tue", 2], ["Wed", 3])],
      NO_BLOCKS,
    );
    expect(next).toEqual([entry("math", "Wed", 3)]);
  });

  it("moves one occurrence out of a stack, leaving the other in place (PR #34 R2)", () => {
    const schedule = [entry("math", "Mon", 1, "r1"), entry("math", "Mon", 1, "r2")];
    const next = applyOverrides(schedule, [move("math", ["Mon", 1], ["Tue", 2])], NO_BLOCKS);
    expect(next).toContainEqual(entry("math", "Tue", 2, "r1"));
    expect(next).toContainEqual(entry("math", "Mon", 1, "r2"));
    expect(next).toHaveLength(2);
  });

  it("keeps each moved block slot's own room (PR #34 R2)", () => {
    const blocks = new Map([["lab", 2]]);
    const schedule = [entry("lab", "Mon", 1, "r1"), entry("lab", "Mon", 2, "r2")];
    const next = applyOverrides(schedule, [move("lab", ["Mon", 1], ["Wed", 3])], blocks);
    expect(next).toContainEqual(entry("lab", "Wed", 3, "r1"));
    expect(next).toContainEqual(entry("lab", "Wed", 4, "r2"));
    expect(next).toHaveLength(2);
  });
});

describe("overridesToPreAssignments", () => {
  it("replaces the pin when the same occurrence is re-moved (chained)", () => {
    const pins = overridesToPreAssignments([
      move("math", ["Mon", 1], ["Tue", 2]),
      move("lab", ["Mon", 3], ["Wed", 1]),
      move("math", ["Tue", 2], ["Fri", 4]),
    ]);
    expect(pins).toEqual([
      { subjectId: "lab", day: "Wed", slot: 1 },
      { subjectId: "math", day: "Fri", slot: 4 },
    ]);
  });

  it("keeps a separate pin for each moved occurrence of one subject (PR #34 R2)", () => {
    const pins = overridesToPreAssignments([
      move("math", ["Mon", 1], ["Tue", 2]),
      move("math", ["Wed", 3], ["Thu", 4]),
    ]);
    expect(pins).toEqual([
      { subjectId: "math", day: "Thu", slot: 4 },
      { subjectId: "math", day: "Tue", slot: 2 },
    ]);
  });
});
