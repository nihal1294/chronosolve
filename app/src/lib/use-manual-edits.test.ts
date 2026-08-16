import { describe, expect, it } from "vitest";
import {
  activeMoves,
  appendMove,
  appendRoom,
  displayedSelection,
  withoutDanglingPins,
  type MoveState,
} from "./use-manual-edits";
import { applyOverrides, type ManualOverride } from "./overrides";
import { appendUnplace, removeUnplaceAt } from "./unplace";
import { buildConflictInputs } from "./conflict-model";
import { findConflicts } from "./conflicts";
import type { ScheduleEntry } from "./solver-client";

const entry = (subject: string, day: string, slot: number, teachers = ["t1"]): ScheduleEntry => ({
  subject_id: subject,
  day,
  slot,
  teacher_ids: teachers,
  group_ids: [subject === "eng" ? "g2" : "g1"],
  room_id: null,
});

const NO_BLOCKS = new Map<string, number>();

describe("activeMoves", () => {
  const schedule = [entry("math", "Mon", 1)];
  const moves: MoveState["moves"] = [
    { kind: "move", subjectId: "math", from: { day: "Mon", slot: 1 }, to: { day: "Tue", slot: 2 } },
  ];

  it("is empty before any edit", () => {
    expect(activeMoves(null, schedule)).toEqual([]);
  });

  it("returns the moves recorded against the current schedule", () => {
    expect(activeMoves({ base: schedule, moves }, schedule)).toBe(moves);
  });

  it("drops edits when a new solve replaces the base schedule", () => {
    const fresh = [entry("math", "Tue", 3)];
    expect(activeMoves({ base: schedule, moves }, fresh)).toEqual([]);
  });
});

describe("appendMove", () => {
  it("records a move anchored at the entry's own slot for single-slot subjects", () => {
    const display = [entry("math", "Mon", 1)];
    const next = appendMove([], display, display[0], { day: "Tue", slot: 3 }, NO_BLOCKS);
    expect(next).toEqual([
      { kind: "move", subjectId: "math", from: { day: "Mon", slot: 1 }, to: { day: "Tue", slot: 3 } },
    ]);
  });

  it("anchors block subjects: dragging any covered slot moves the whole block", () => {
    const blocks = new Map([["lab", 2]]);
    const display = [entry("lab", "Mon", 1), entry("lab", "Mon", 2)];
    const next = appendMove([], display, display[1], { day: "Tue", slot: 1 }, blocks);
    expect(next).toEqual([
      { kind: "move", subjectId: "lab", from: { day: "Mon", slot: 1 }, to: { day: "Tue", slot: 1 } },
    ]);
    expect(applyOverrides(display, next, blocks)).toEqual([entry("lab", "Tue", 1), entry("lab", "Tue", 2)]);
  });

  it("ignores a drop onto the block's own anchor", () => {
    const display = [entry("math", "Mon", 1)];
    const moves = appendMove([], display, display[0], { day: "Mon", slot: 1 }, NO_BLOCKS);
    expect(moves).toEqual([]);
  });
});

describe("appendRoom (M8c room verb)", () => {
  it("records a room change anchored at the block start, from any covered slot", () => {
    const blocks = new Map([["lab", 2]]);
    const display = [
      { ...entry("lab", "Mon", 1), room_id: "r1" },
      { ...entry("lab", "Mon", 2), room_id: "r1" },
    ];
    const next = appendRoom([], display, display[1], "r9", blocks);
    expect(next).toEqual([{ kind: "room", subjectId: "lab", at: { day: "Mon", slot: 1 }, roomId: "r9" }]);
    expect(applyOverrides(display, next, blocks)).toEqual([
      { ...entry("lab", "Mon", 1), room_id: "r9" },
      { ...entry("lab", "Mon", 2), room_id: "r9" },
    ]);
  });

  it("re-picking the room the entry already shows is a no-op (list identity)", () => {
    const overrides: ManualOverride[] = [];
    const display = [{ ...entry("math", "Mon", 1), room_id: "r1" }];
    expect(appendRoom(overrides, display, display[0], "r1", NO_BLOCKS)).toBe(overrides);
  });
});

describe("displayedSelection (stale panel target after a drag, PR #36 round 2)", () => {
  it("keeps a selection whose exact entry is still rendered", () => {
    const kept = entry("eng", "Mon", 2);
    expect(displayedSelection([kept, entry("math", "Tue", 1)], kept)).toBe(kept);
  });

  it("clears when the entry is gone, even if an equal-content one replaced it", () => {
    const stale = entry("math", "Mon", 1);
    expect(displayedSelection([entry("math", "Mon", 1)], stale)).toBeNull();
    expect(displayedSelection([], null)).toBeNull();
  });

  it("moving the selected block clears it; an unrelated move keeps it", () => {
    const base = [entry("math", "Mon", 1), entry("eng", "Mon", 2)];
    const moves = appendMove([], base, base[0], { day: "Tue", slot: 3 }, NO_BLOCKS);
    const display = applyOverrides(base, moves, NO_BLOCKS);
    expect(displayedSelection(display, base[0])).toBeNull(); // math moved: replaced object
    expect(displayedSelection(display, base[1])).toBe(base[1]); // eng untouched: same object
  });
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

describe("move -> conflict composition (the drag-and-see-what-breaks contract)", () => {
  const doc = {
    time_structure: { days: ["Mon", "Tue"], slots_per_day: 4 },
    teachers: [{ id: "t1", name: "A" }],
    student_groups: [
      { id: "g1", name: "G1", size: 30 },
      { id: "g2", name: "G2", size: 25 },
    ],
    subjects: [
      { id: "math", name: "M", hours_per_week: 1, teacher_ids: ["t1"], group_ids: ["g1"] },
      { id: "eng", name: "E", hours_per_week: 1, teacher_ids: ["t1"], group_ids: ["g2"] },
    ],
  };

  it("flags a teacher double-book after moving math onto eng's slot", () => {
    const base = [entry("math", "Mon", 1), entry("eng", "Mon", 2)];
    const moves = appendMove([], base, base[0], { day: "Mon", slot: 2 }, NO_BLOCKS);
    const display = applyOverrides(base, moves, NO_BLOCKS);
    const conflicts = findConflicts(buildConflictInputs(doc), display);
    expect(conflicts.map((c) => c.kind)).toEqual(["teacher-double-book"]);
    expect(new Set(conflicts[0].entryKeys)).toEqual(new Set(["math|Mon|2", "eng|Mon|2"]));
  });

  it("unplacing one side of a double-book clears it", () => {
    const base = [entry("math", "Mon", 1), entry("eng", "Mon", 2)];
    const moved = appendMove([], base, base[0], { day: "Mon", slot: 2 }, NO_BLOCKS);
    const clashing = applyOverrides(base, moved, NO_BLOCKS);
    expect(findConflicts(buildConflictInputs(doc), clashing)).toHaveLength(1);

    const log = appendUnplace(moved, clashing, clashing[0], NO_BLOCKS, new Set<string>());
    const display = applyOverrides(base, log, NO_BLOCKS);
    expect(findConflicts(buildConflictInputs(doc), display)).toEqual([]);
  });

  it("puts a session back onto a slot another moved into, stacked, and reports the clash", () => {
    // The M10 edge case: Put back never refuses because the slot filled up
    // behind it - the mirror shows what broke, matching drag's own
    // "drop and see what breaks" rule.
    const base = [entry("math", "Mon", 1), entry("eng", "Tue", 2)];
    const unplaced = appendUnplace([], base, base[0], NO_BLOCKS, new Set<string>());
    const withoutMath = applyOverrides(base, unplaced, NO_BLOCKS);
    const log = appendMove(unplaced, withoutMath, withoutMath[0], { day: "Mon", slot: 1 }, NO_BLOCKS);
    expect(findConflicts(buildConflictInputs(doc), applyOverrides(base, log, NO_BLOCKS))).toEqual([]);

    // Put back drops the unplace from the MIDDLE of the log; math returns to
    // Mon 1, which eng now occupies.
    const step = removeUnplaceAt(log, 0);
    const conflicts = findConflicts(buildConflictInputs(doc), applyOverrides(base, step!.next, NO_BLOCKS));
    expect(conflicts.map((c) => c.kind)).toEqual(["teacher-double-book"]);
    expect(new Set(conflicts[0].entryKeys)).toEqual(new Set(["math|Mon|1", "eng|Mon|1"]));
  });
});
