import { describe, expect, it } from "vitest";
import { toCsv } from "./export-file";
import type { ScheduleEntry } from "./solver-client";

const entry = (over: Partial<ScheduleEntry>): ScheduleEntry => ({
  subject_id: "math",
  day: "Monday",
  slot: 1,
  teacher_ids: ["t1", "t2"],
  group_ids: ["g1"],
  room_id: "r1",
  ...over,
});

describe("toCsv", () => {
  it("mirrors the backend exporter: header + one row per scheduled hour", () => {
    expect(toCsv([entry({})])).toBe("day,slot,subject,teachers,groups,room\nMonday,1,math,t1;t2,g1,r1\n");
  });

  it("leaves the room column empty when unassigned", () => {
    expect(toCsv([entry({ room_id: null })])).toContain("Monday,1,math,t1;t2,g1,\n");
  });

  it("quotes fields containing commas or quotes per RFC 4180", () => {
    const csv = toCsv([entry({ subject_id: 'lab "a", advanced' })]);
    expect(csv).toContain('"lab ""a"", advanced"');
  });
});
