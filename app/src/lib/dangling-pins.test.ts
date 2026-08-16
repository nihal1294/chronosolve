import { describe, expect, it } from "vitest";
import { withoutDanglingPins } from "./dangling-pins";
import type { ScheduleEntry } from "./solver-client";

const entry = (subject: string, day: string, slot: number): ScheduleEntry => ({
  subject_id: subject,
  day,
  slot,
  teacher_ids: ["t1"],
  group_ids: ["g1"],
  room_id: null,
});

describe("withoutDanglingPins (Reset edits reverts pin-after-move, PR #36 review)", () => {
  const schedule = [entry("math", "Mon", 2)];
  const matching = { subject_id: "math", day: "Mon", slot: 2 };
  const dangling = { subject_id: "math", day: "Fri", slot: 4 };

  it("drops pins matching no schedule slot, keeping the rest", () => {
    const doc = { pre_assignments: [matching, dangling, "malformed"] };
    expect(withoutDanglingPins(doc, schedule).pre_assignments).toEqual([matching, "malformed"]);
  });

  it("returns the doc unchanged (same reference) when nothing dangles", () => {
    const allMatching = { pre_assignments: [matching] };
    const noPins = {};
    expect(withoutDanglingPins(allMatching, schedule)).toBe(allMatching);
    expect(withoutDanglingPins(noPins, schedule)).toBe(noPins);
  });

  it("prunes nothing against an empty schedule (no result to compare with)", () => {
    const doc = { pre_assignments: [dangling] };
    expect(withoutDanglingPins(doc, [])).toBe(doc);
  });
});
