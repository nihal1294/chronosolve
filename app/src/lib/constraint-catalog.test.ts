import { describe, expect, it } from "vitest";
import { HARD_CONSTRAINTS, SOFT_CONSTRAINTS } from "./constraint-catalog";

describe("constraint catalog", () => {
  it("covers the 5 hard constraints the solver model defines", () => {
    expect(HARD_CONSTRAINTS.map((c) => c.key)).toEqual([
      "teacher_no_clash",
      "group_no_clash",
      "room_no_clash",
      "respect_availability",
      "required_hours",
    ]);
  });

  it("covers all 10 soft constraints", () => {
    expect(SOFT_CONSTRAINTS).toHaveLength(10);
  });

  it("marks every soft constraint as scored (M7.5 closed the base-weight gap)", () => {
    const scored = SOFT_CONSTRAINTS.filter((c) => c.scored)
      .map((c) => c.key)
      .sort();
    expect(scored).toEqual(
      [
        "avoid_consecutive_hours",
        "compact_schedules",
        "free_days",
        "leave_early",
        "max_hours_per_day",
        "minimize_student_gaps",
        "minimize_teacher_gaps",
        "spread_subjects",
        "teacher_time_preferences",
        "workload_balance",
      ].sort(),
    );
  });

  // QualityReport.metrics is keyed by scoring/quality.py's _METRICS dict keys
  // (short names), NOT the soft-constraint config keys. This mapping must mirror
  // _METRICS so the post-solve impact line reads the right metric.
  it("maps each scored constraint to its /score metric key", () => {
    const mapping = Object.fromEntries(
      SOFT_CONSTRAINTS.filter((c) => c.scored).map((c) => [c.key, c.metricKey]),
    );
    expect(mapping).toEqual({
      minimize_student_gaps: "student_gaps",
      minimize_teacher_gaps: "teacher_gaps",
      spread_subjects: "subject_spread",
      teacher_time_preferences: "teacher_preferences",
      compact_schedules: "compactness",
      workload_balance: "workload_balance",
      avoid_consecutive_hours: "consecutive_hours",
      leave_early: "leave_early",
      max_hours_per_day: "max_daily_hours",
      free_days: "free_days",
    });
  });

  it("gives every soft constraint a metric key - no unscored entries remain", () => {
    SOFT_CONSTRAINTS.forEach((c) => {
      expect(c.scored, `${c.key} must be scored`).toBe(true);
      expect(c.metricKey, `${c.key} must map to a metric`).toBeDefined();
    });
  });
});
