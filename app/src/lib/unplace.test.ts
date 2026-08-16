import { describe, expect, it } from "vitest";
import { appendUnplace, insertOverrideAt, removeUnplaceAt, unplacedLabel, unplacedList } from "./unplace";
import { applyOverrides, type ManualOverride } from "./overrides";
import type { ScheduleEntry } from "./solver-client";

const entry = (subject: string, day: string, slot: number): ScheduleEntry => ({
  subject_id: subject,
  day,
  slot,
  teacher_ids: ["t1"],
  group_ids: ["g1"],
  room_id: null,
});

const move = (subject: string, from: [string, number], to: [string, number]): ManualOverride => ({
  kind: "move",
  subjectId: subject,
  from: { day: from[0], slot: from[1] },
  to: { day: to[0], slot: to[1] },
});

const NO_BLOCKS = new Map<string, number>();
const NO_LOCKS = new Set<string>();

describe("appendUnplace", () => {
  it("records an unplace anchored at the entry's own slot for single-slot subjects", () => {
    const display = [entry("math", "Mon", 1)];
    expect(appendUnplace([], display, display[0], NO_BLOCKS, NO_LOCKS)).toEqual([
      { kind: "unplace", subjectId: "math", at: { day: "Mon", slot: 1 } },
    ]);
  });

  it("anchors block subjects: unplacing any covered slot takes the whole block", () => {
    const blocks = new Map([["lab", 2]]);
    const display = [entry("lab", "Mon", 1), entry("lab", "Mon", 2)];
    const next = appendUnplace([], display, display[1], blocks, NO_LOCKS);
    expect(next).toEqual([{ kind: "unplace", subjectId: "lab", at: { day: "Mon", slot: 1 } }]);
    expect(applyOverrides(display, next, blocks)).toEqual([]);
  });

  it("records WHICH occupant of a stacked slot was selected", () => {
    // Identity is not carried into the override (it must survive replay from
    // the base schedule), so the position among same-key entries is what
    // tells applyUnplace which card the user actually clicked.
    const display = [
      { ...entry("math", "Mon", 1), room_id: "r1" },
      { ...entry("math", "Mon", 1), room_id: "r2" },
    ];
    expect(appendUnplace([], display, display[1], NO_BLOCKS, NO_LOCKS)).toEqual([
      { kind: "unplace", subjectId: "math", at: { day: "Mon", slot: 1 }, occurrence: 1 },
    ]);
  });

  it("omits the occurrence for the ordinary lone-session case", () => {
    const display = [entry("math", "Mon", 1)];
    expect(appendUnplace([], display, display[0], NO_BLOCKS, NO_LOCKS)).toEqual([
      { kind: "unplace", subjectId: "math", at: { day: "Mon", slot: 1 } },
    ]);
  });

  it("refuses a pinned session with a list-identity return (unpin first)", () => {
    const overrides: ManualOverride[] = [];
    const display = [entry("math", "Mon", 1)];
    const locked = new Set(["math|Mon|1"]);
    expect(appendUnplace(overrides, display, display[0], NO_BLOCKS, locked)).toBe(overrides);
  });
});

describe("removeUnplaceAt (the Put back verb)", () => {
  const log: ManualOverride[] = [
    move("eng", ["Mon", 1], ["Tue", 2]),
    { kind: "unplace", subjectId: "math", at: { day: "Wed", slot: 3 } },
    move("art", ["Thu", 1], ["Fri", 1]),
  ];

  it("removes the unplace at the given index and hands it back", () => {
    const step = removeUnplaceAt(log, 1);
    expect(step?.removed).toEqual(log[1]);
    expect(step?.next).toEqual([log[0], log[2]]);
  });

  it("returns null when the index holds something other than an unplace", () => {
    expect(removeUnplaceAt(log, 0)).toBeNull();
    expect(removeUnplaceAt(log, 9)).toBeNull();
    expect(removeUnplaceAt(log, -1)).toBeNull();
  });

  it("round-trips with insertOverrideAt: re-inserting restores the exact log", () => {
    const step = removeUnplaceAt(log, 1);
    expect(insertOverrideAt(step!.next, step!.removed, 1)).toEqual(log);
  });

  it("re-inserting at the END is reachable (an unplace recorded last)", () => {
    const tail: ManualOverride[] = [log[0], log[1]];
    const step = removeUnplaceAt(tail, 1);
    expect(insertOverrideAt(step!.next, step!.removed, 1)).toEqual(tail);
  });
});

describe("unplacedList / unplacedLabel (the tray)", () => {
  it("lists every unplace with its index in the log, ignoring other verbs", () => {
    const log: ManualOverride[] = [
      move("eng", ["Mon", 1], ["Tue", 2]),
      { kind: "unplace", subjectId: "math", at: { day: "Wed", slot: 3 } },
      { kind: "unplace", subjectId: "art", at: { day: "Thu", slot: 1 } },
    ];
    expect(unplacedList(log)).toEqual([
      { index: 1, subjectId: "math", day: "Wed", slot: 3 },
      { index: 2, subjectId: "art", day: "Thu", slot: 1 },
    ]);
  });

  it("is empty for a log with no unplaces", () => {
    expect(unplacedList([move("eng", ["Mon", 1], ["Tue", 2])])).toEqual([]);
  });

  it("labels a row with the subject name and where it sat", () => {
    const item = { index: 0, subjectId: "math", day: "Wed", slot: 3 };
    expect(unplacedLabel(item, "Mathematics", "09:00 - 09:55")).toBe("Mathematics - was Wed 09:00 - 09:55");
  });
});
