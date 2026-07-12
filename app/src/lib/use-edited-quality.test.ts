import { describe, expect, it } from "vitest";
import { visibleEditedScore } from "./use-edited-quality";
import type { ScheduleEntry } from "./solver-client";

const entry = (subject: string, day: string, slot: number): ScheduleEntry => ({
  subject_id: subject,
  day,
  slot,
  teacher_ids: ["t1"],
  group_ids: ["g1"],
  room_id: null,
});

describe("visibleEditedScore", () => {
  const shown = [entry("math", "Mon", 1)];

  it("shows the score priced for exactly the shown schedule", () => {
    expect(visibleEditedScore({ schedule: shown, score: 87.5 }, shown, true)).toBe(87.5);
  });

  it("hides a stale score priced for a superseded schedule (PR #36 review)", () => {
    const superseded = [entry("math", "Tue", 2)];
    expect(visibleEditedScore({ schedule: superseded, score: 42 }, shown, true)).toBeNull();
  });

  it("stays conservative: equal content under a different identity is not shown", () => {
    const rebuilt = [entry("math", "Mon", 1)];
    expect(visibleEditedScore({ schedule: rebuilt, score: 87.5 }, shown, true)).toBeNull();
  });

  it("returns null once edits reset or a new solve lands (edited=false)", () => {
    expect(visibleEditedScore({ schedule: shown, score: 87.5 }, shown, false)).toBeNull();
    expect(visibleEditedScore(null, shown, true)).toBeNull();
  });
});
