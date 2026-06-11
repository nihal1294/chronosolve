import { describe, expect, it } from "vitest";
import { pivotByGroup } from "./grid";
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
