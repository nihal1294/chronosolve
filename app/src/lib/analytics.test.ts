import { describe, expect, it } from "vitest";
import { humanizeMetric, impactShares, penaltyShares, roomUtilization } from "./analytics";
import type { QualityReport, ScheduleEntry } from "./solver-client";

const entry = (over: Partial<ScheduleEntry>): ScheduleEntry => ({
  subject_id: "math",
  day: "Monday",
  slot: 1,
  teacher_ids: [],
  group_ids: ["g1"],
  room_id: "r1",
  ...over,
});

const report = (metrics: Record<string, number>): QualityReport => ({
  overall_score: 90,
  hard_violations: [],
  metrics,
  details: {},
});

describe("roomUtilization", () => {
  it("counts distinct occupied room-slots over total capacity", () => {
    const schedule = [entry({}), entry({ slot: 2 }), entry({ room_id: "r2", slot: 1, subject_id: "sci" })];
    // 3 occupied of 2 rooms x 2 days x 2 slots = 8 -> 37.5%
    expect(roomUtilization(schedule, 2, 2, 2)).toBeCloseTo(37.5);
  });

  it("ignores entries without a room", () => {
    expect(roomUtilization([entry({ room_id: null })], 1, 1, 1)).toBe(0);
  });

  it("returns null when there is no room capacity to measure", () => {
    expect(roomUtilization([entry({})], 0, 5, 8)).toBeNull();
  });
});

describe("penaltyShares", () => {
  it("normalizes per-metric penalties into descending percentage shares", () => {
    const shares = penaltyShares(report({ minimize_student_gaps: 70, spread_subjects: 90 }));
    // penalties 30 and 10 -> 75% / 25%
    expect(shares).toEqual([
      { label: "Minimize Student Gaps", share: 75 },
      { label: "Spread Subjects", share: 25 },
    ]);
  });

  it("drops perfect metrics and returns empty when nothing is penalized", () => {
    expect(penaltyShares(report({ a: 100, b: 100 }))).toEqual([]);
  });
});

describe("humanizeMetric", () => {
  it("turns snake_case metric keys into title case labels", () => {
    expect(humanizeMetric("teacher_time_preferences")).toBe("Teacher Time Preferences");
  });
});

describe("impactShares", () => {
  it("is all-zero when every metric is perfect", () => {
    expect(impactShares({ a: 100, b: 100 })).toEqual({ a: 0, b: 0 });
  });

  it("splits the total penalty proportionally", () => {
    // a penalty 40, b penalty 10 -> total 50 -> 80% / 20%
    expect(impactShares({ a: 60, b: 90 })).toEqual({ a: 80, b: 20 });
  });
});
