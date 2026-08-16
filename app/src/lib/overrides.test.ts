import { describe, expect, it } from "vitest";
import { applyOverrides, type ManualOverride } from "./overrides";
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

const room = (subject: string, at: [string, number], roomId: string): ManualOverride => ({
  kind: "room",
  subjectId: subject,
  at: { day: at[0], slot: at[1] },
  roomId,
});

const unplace = (subject: string, at: [string, number]): ManualOverride => ({
  kind: "unplace",
  subjectId: subject,
  at: { day: at[0], slot: at[1] },
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

  it("rewrites the room on every covered block slot (room override, M8c)", () => {
    const blocks = new Map([["lab", 2]]);
    const schedule = [entry("lab", "Mon", 1, "r1"), entry("lab", "Mon", 2, "r2"), entry("eng", "Mon", 3)];
    const next = applyOverrides(schedule, [room("lab", ["Mon", 1], "r9")], blocks);
    expect(next).toContainEqual(entry("lab", "Mon", 1, "r9"));
    expect(next).toContainEqual(entry("lab", "Mon", 2, "r9"));
    expect(next).toContainEqual(entry("eng", "Mon", 3));
  });

  it("retargets only the first occupant of a stacked key (room override)", () => {
    const schedule = [entry("math", "Mon", 1, "r1"), entry("math", "Mon", 1, "r2")];
    const next = applyOverrides(schedule, [room("math", ["Mon", 1], "r9")], NO_BLOCKS);
    expect(next).toContainEqual(entry("math", "Mon", 1, "r9"));
    expect(next).toContainEqual(entry("math", "Mon", 1, "r2"));
    expect(next).toHaveLength(2);
  });

  it("returns the schedule identity when the room already matches", () => {
    const schedule = [entry("math", "Mon", 1, "r1")];
    expect(applyOverrides(schedule, [room("math", ["Mon", 1], "r1")], NO_BLOCKS)).toBe(schedule);
  });

  it("a move after a room change carries the new room (composition)", () => {
    const schedule = [entry("math", "Mon", 1, "r1")];
    const next = applyOverrides(
      schedule,
      [room("math", ["Mon", 1], "r9"), move("math", ["Mon", 1], ["Tue", 2])],
      NO_BLOCKS,
    );
    expect(next).toEqual([entry("math", "Tue", 2, "r9")]);
  });

  it("takes a single-slot session off the grid and leaves the rest (M10)", () => {
    const schedule = [entry("math", "Mon", 1, "r1"), entry("eng", "Mon", 2)];
    const next = applyOverrides(schedule, [unplace("math", ["Mon", 1])], NO_BLOCKS);
    expect(next).toEqual([entry("eng", "Mon", 2)]);
  });

  it("takes the whole block off the grid, not just the anchor slot", () => {
    const blocks = new Map([["lab", 2]]);
    const schedule = [entry("lab", "Mon", 1, "r2"), entry("lab", "Mon", 2, "r2"), entry("eng", "Mon", 3)];
    const next = applyOverrides(schedule, [unplace("lab", ["Mon", 1])], blocks);
    expect(next).toEqual([entry("eng", "Mon", 3)]);
  });

  it("drops ONE entry per covered key, matching applyMove's rule", () => {
    // Defensive: one subject holding a slot twice is refused at both doors
    // (canDropSession, canPutBack) and cannot come from a solve, so this
    // exists to pin the shared "one per key" rule rather than to describe a
    // reachable screen. The pin plan reads these keys the same way, which is
    // why the display and the saved problem cannot disagree about which
    // occurrence left.
    const schedule = [entry("math", "Mon", 1, "r1"), entry("math", "Mon", 1, "r2")];
    const next = applyOverrides(schedule, [unplace("math", ["Mon", 1])], NO_BLOCKS);
    expect(next).toEqual([entry("math", "Mon", 1, "r2")]);
  });

  it("returns the schedule identity for a stale unplace (block no longer there)", () => {
    const schedule = [entry("math", "Mon", 1)];
    expect(applyOverrides(schedule, [unplace("math", ["Fri", 4])], NO_BLOCKS)).toBe(schedule);
  });

  it("composes after a move: the unplace anchors at the moved-to slot", () => {
    const schedule = [entry("math", "Mon", 1), entry("eng", "Tue", 2)];
    const next = applyOverrides(
      schedule,
      [move("math", ["Mon", 1], ["Wed", 3]), unplace("math", ["Wed", 3])],
      NO_BLOCKS,
    );
    expect(next).toEqual([entry("eng", "Tue", 2)]);
  });
});
