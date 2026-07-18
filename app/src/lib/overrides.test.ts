import { describe, expect, it } from "vitest";
import {
  applyOverrides,
  applyPins,
  overridesToPreAssignments,
  pinDiff,
  unappliedPinCount,
  type ManualOverride,
} from "./overrides";
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

  it("a room change pins its slot with the room (persist = time+room pin)", () => {
    const pins = overridesToPreAssignments([room("math", ["Mon", 1], "r9")]);
    expect(pins).toEqual([{ subjectId: "math", day: "Mon", slot: 1, roomId: "r9" }]);
  });

  it("move-then-room pins the new slot with the room", () => {
    const pins = overridesToPreAssignments([
      move("math", ["Mon", 1], ["Tue", 2]),
      room("math", ["Tue", 2], "r9"),
    ]);
    expect(pins).toEqual([{ subjectId: "math", day: "Tue", slot: 2, roomId: "r9" }]);
  });

  it("room-then-move carries the room to the new pin", () => {
    const pins = overridesToPreAssignments([
      room("math", ["Mon", 1], "r9"),
      move("math", ["Mon", 1], ["Tue", 2]),
    ]);
    expect(pins).toEqual([{ subjectId: "math", day: "Tue", slot: 2, roomId: "r9" }]);
  });

  it("two moved occurrences keep independent rooms", () => {
    const pins = overridesToPreAssignments([
      move("math", ["Mon", 1], ["Tue", 2]),
      room("math", ["Tue", 2], "r1"),
      move("math", ["Wed", 3], ["Thu", 4]),
      room("math", ["Thu", 4], "r2"),
    ]);
    expect(pins).toEqual([
      { subjectId: "math", day: "Thu", slot: 4, roomId: "r2" },
      { subjectId: "math", day: "Tue", slot: 2, roomId: "r1" },
    ]);
  });
});

describe("applyPins / unappliedPinCount (Apply edits, M8c)", () => {
  it("upserts every pin into the doc and skips the write when all are present", () => {
    const doc = { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1 }] };
    const pins = [
      { subjectId: "math", day: "Mon", slot: 1 },
      { subjectId: "eng", day: "Tue", slot: 2, roomId: "r1" },
    ];
    const applied = applyPins(doc, pins);
    expect(applied.pre_assignments).toEqual([
      { subject_id: "math", day: "Mon", slot: 1 },
      { subject_id: "eng", day: "Tue", slot: 2, room_id: "r1" },
    ]);
    expect(applyPins(applied, pins)).toBe(applied); // second apply: identity, no doc write
  });

  it("counts the session pins missing from the doc (slot AND room must match)", () => {
    const overrides = [
      move("math", ["Mon", 1], ["Tue", 2]),
      room("math", ["Tue", 2], "r9"),
      move("eng", ["Mon", 3], ["Wed", 1]),
    ];
    expect(unappliedPinCount({}, overrides)).toBe(2);
    const partial = { pre_assignments: [{ subject_id: "eng", day: "Wed", slot: 1 }] };
    expect(unappliedPinCount(partial, overrides)).toBe(1);
    const wrongRoom = {
      pre_assignments: [
        { subject_id: "math", day: "Tue", slot: 2, room_id: "r1" },
        { subject_id: "eng", day: "Wed", slot: 1 },
      ],
    };
    expect(unappliedPinCount(wrongRoom, overrides)).toBe(1);
    const full = {
      pre_assignments: [
        { subject_id: "math", day: "Tue", slot: 2, room_id: "r9" },
        { subject_id: "eng", day: "Wed", slot: 1 },
      ],
    };
    expect(unappliedPinCount(full, overrides)).toBe(0);
  });
});

describe("pinDiff (edit-history apply payload, M8c)", () => {
  const pins = [
    { subjectId: "math", day: "Mon", slot: 1 },
    { subjectId: "eng", day: "Tue", slot: 2, roomId: "r2" },
  ];

  it("splits pins into added and replaced-with-PRIOR-room", () => {
    const doc = { pre_assignments: [{ subject_id: "eng", day: "Tue", slot: 2, room_id: "r1" }] };
    expect(pinDiff(doc, pins)).toEqual({
      added: [{ subjectId: "math", day: "Mon", slot: 1 }],
      replaced: [{ subjectId: "eng", day: "Tue", slot: 2, roomId: "r1" }],
    });
  });

  it("agrees with applyPins on whether anything changes (data contract)", () => {
    const docs = [
      {},
      { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1 }] },
      { pre_assignments: [{ subject_id: "eng", day: "Tue", slot: 2 }] },
      { pre_assignments: [{ subject_id: "eng", day: "Tue", slot: 2, room_id: "r1" }] },
      {
        pre_assignments: [
          { subject_id: "math", day: "Mon", slot: 1 },
          { subject_id: "eng", day: "Tue", slot: 2, room_id: "r2" },
        ],
      },
    ];
    for (const doc of docs) {
      const { added, replaced } = pinDiff(doc, pins);
      expect(applyPins(doc, pins) !== doc).toBe(added.length + replaced.length > 0);
    }
  });

  it("a room-upsert onto a roomless pin records the bare prior (undo re-pins bare)", () => {
    const doc = { pre_assignments: [{ subject_id: "eng", day: "Tue", slot: 2 }] };
    expect(pinDiff(doc, pins).replaced).toEqual([{ subjectId: "eng", day: "Tue", slot: 2 }]);
  });
});
