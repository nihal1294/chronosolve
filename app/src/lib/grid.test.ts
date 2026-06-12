import { describe, expect, it } from "vitest";
import { blockAnchor, expandLockedKeys, pivotByGroup, scheduleKey } from "./grid";
import type { ScheduleEntry } from "./solver-client";

const entry = (over: Partial<ScheduleEntry>): ScheduleEntry => ({
  subject_id: "math",
  day: "Monday",
  slot: 1,
  teacher_ids: ["t1"],
  group_ids: ["g1"],
  room_id: null,
  ...over,
});

describe("pivotByGroup", () => {
  it("indexes entries by group, day, and slot", () => {
    const grid = pivotByGroup([
      entry({}),
      entry({ subject_id: "sci", slot: 2, room_id: "r1" }),
      entry({ subject_id: "eng", group_ids: ["g2"] }),
    ]);
    expect(grid.get("g1")?.get("Monday")?.get(1)?.subject_id).toBe("math");
    expect(grid.get("g1")?.get("Monday")?.get(2)?.room_id).toBe("r1");
    expect(grid.get("g2")?.size).toBe(1);
  });

  it("lists a multi-group entry under every group", () => {
    const grid = pivotByGroup([entry({ group_ids: ["g1", "g2"] })]);
    expect(grid.get("g1")?.get("Monday")?.get(1)).toBeDefined();
    expect(grid.get("g2")?.get("Monday")?.get(1)).toBeDefined();
  });

  it("returns an empty grid for an empty schedule", () => {
    expect(pivotByGroup([]).size).toBe(0);
  });
});

// A 3-hour lab block on Tuesday slots 4-6: one ScheduleEntry per slot.
const lab = [4, 5, 6].map((slot) => entry({ subject_id: "lab", day: "Tuesday", slot }));
const labSizes = new Map([["lab", 3]]);

describe("blockAnchor", () => {
  it("anchors any slot of a block to the block start", () => {
    for (const slot of [4, 5, 6]) {
      expect(blockAnchor(lab, lab[slot - 4], labSizes).slot).toBe(4);
    }
  });

  it("anchors single-slot subjects to themselves even when sessions are adjacent", () => {
    const twoSessions = [entry({ slot: 2 }), entry({ slot: 3 })];
    expect(blockAnchor(twoSessions, twoSessions[1], new Map([["math", 1]])).slot).toBe(3);
  });

  it("splits back-to-back blocks at the tiling boundary", () => {
    const doubleLab = [1, 2, 3, 4, 5, 6].map((slot) => entry({ subject_id: "lab", slot }));
    expect(blockAnchor(doubleLab, doubleLab[2], labSizes).slot).toBe(1); // slot 3 -> first block
    expect(blockAnchor(doubleLab, doubleLab[3], labSizes).slot).toBe(4); // slot 4 -> second block
  });

  it("treats subjects missing from the size map as single slots", () => {
    expect(blockAnchor(lab, lab[1], new Map()).slot).toBe(5);
  });
});

describe("expandLockedKeys", () => {
  it("locks every slot of a block pinned at its start", () => {
    const pins = new Set([scheduleKey("lab", "Tuesday", 4)]);
    const locked = expandLockedKeys(lab, pins, labSizes);
    expect([4, 5, 6].every((slot) => locked.has(scheduleKey("lab", "Tuesday", slot)))).toBe(true);
  });

  it("ignores pins that do not sit on a block start", () => {
    const pins = new Set([scheduleKey("lab", "Tuesday", 5)]);
    expect(expandLockedKeys(lab, pins, labSizes).size).toBe(0);
  });

  it("locks exactly the pinned slot for single-slot subjects", () => {
    const schedule = [entry({ slot: 2 }), entry({ slot: 3 })];
    const locked = expandLockedKeys(schedule, new Set([scheduleKey("math", "Monday", 3)]), new Map());
    expect(locked.has(scheduleKey("math", "Monday", 3))).toBe(true);
    expect(locked.size).toBe(1);
  });
});
