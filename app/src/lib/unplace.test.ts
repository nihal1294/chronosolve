import { describe, expect, it } from "vitest";
import {
  appendUnplace,
  canPutBack,
  insertOverrideAt,
  removeUnplaceAt,
  unplacedLabel,
  unplacedList,
} from "./unplace";
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

  it("records subject, day and slot alone - no tie-breaker is needed", () => {
    // (subject, day, slot) is a unique occurrence because one subject never
    // holds a slot twice. That is what lets the pin plan, which keys on the
    // same triple, agree with the grid about which occurrence left.
    const display = [entry("math", "Mon", 1), entry("math", "Tue", 1)];
    expect(appendUnplace([], display, display[1], NO_BLOCKS, NO_LOCKS)).toEqual([
      { kind: "unplace", subjectId: "math", at: { day: "Tue", slot: 1 } },
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

describe("canPutBack (the one-session-per-slot guard)", () => {
  // Put back is the only edit that removes from the MIDDLE of the log - every
  // other verb appends and undo pops the tail - so it is the only way a replay
  // can seat a returning occurrence on top of one that moved in behind it.
  const base = [entry("math", "Mon", 1), entry("math", "Tue", 1)];

  it("allows a put back that lands on the slot it left", () => {
    const log: ManualOverride[] = [{ kind: "unplace", subjectId: "math", at: { day: "Mon", slot: 1 } }];
    expect(canPutBack(log, 0, base, NO_BLOCKS)).toBe(true);
  });

  it("refuses when another occurrence of that subject has since moved in", () => {
    const log: ManualOverride[] = [
      { kind: "unplace", subjectId: "math", at: { day: "Mon", slot: 1 } },
      move("math", ["Tue", 1], ["Mon", 1]),
    ];
    // Replaying without the unplace puts both occurrences on Mon slot 1 - a
    // state no solve can produce and pre_assignments cannot store.
    expect(canPutBack(log, 0, base, NO_BLOCKS)).toBe(false);
  });

  it("allows a put back when the slot took a DIFFERENT subject (an ordinary conflict)", () => {
    const withEng = [...base, entry("eng", "Wed", 1)];
    const log: ManualOverride[] = [
      { kind: "unplace", subjectId: "math", at: { day: "Mon", slot: 1 } },
      move("eng", ["Wed", 1], ["Mon", 1]),
    ];
    expect(canPutBack(log, 0, withEng, NO_BLOCKS)).toBe(true);
  });

  it("is false at an index holding anything but an unplace", () => {
    expect(canPutBack([move("eng", ["Mon", 1], ["Tue", 2])], 0, base, NO_BLOCKS)).toBe(false);
  });
});

describe("unplacedList / unplacedLabel (the tray)", () => {
  const base = [entry("math", "Wed", 3), entry("art", "Thu", 1), entry("eng", "Mon", 1)];

  it("lists every unplace with its index in the log, ignoring other verbs", () => {
    const log: ManualOverride[] = [
      move("eng", ["Mon", 1], ["Tue", 2]),
      { kind: "unplace", subjectId: "math", at: { day: "Wed", slot: 3 } },
      { kind: "unplace", subjectId: "art", at: { day: "Thu", slot: 1 } },
    ];
    expect(unplacedList(log, base, NO_BLOCKS)).toEqual([
      { index: 1, subjectId: "math", day: "Wed", slot: 3, blocked: false },
      { index: 2, subjectId: "art", day: "Thu", slot: 1, blocked: false },
    ]);
  });

  it("marks a row blocked when putting it back would stack the subject", () => {
    const twice = [entry("math", "Wed", 3), entry("math", "Thu", 2)];
    const log: ManualOverride[] = [
      { kind: "unplace", subjectId: "math", at: { day: "Wed", slot: 3 } },
      move("math", ["Thu", 2], ["Wed", 3]),
    ];
    expect(unplacedList(log, twice, NO_BLOCKS)[0].blocked).toBe(true);
  });

  it("is empty for a log with no unplaces", () => {
    expect(unplacedList([move("eng", ["Mon", 1], ["Tue", 2])], base, NO_BLOCKS)).toEqual([]);
  });

  it("labels a row with the subject name and where it sat", () => {
    const item = { index: 0, subjectId: "math", day: "Wed", slot: 3, blocked: false };
    expect(unplacedLabel(item, "Mathematics", "09:00 - 09:55")).toBe("Mathematics - was Wed 09:00 - 09:55");
  });
});
