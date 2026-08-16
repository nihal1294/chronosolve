import { describe, expect, it } from "vitest";
import {
  applyPins,
  applyPlan,
  hasUnappliedEdits,
  overridesToPreAssignments,
  pinDiff,
  planApplyDoc,
  unappliedPinCount,
} from "./apply-edits";
import type { ManualOverride } from "./overrides";

const move = (subject: string, from: [string, number], to: [string, number]): ManualOverride => ({
  kind: "move",
  subjectId: subject,
  from: { day: from[0], slot: from[1] },
  to: { day: to[0], slot: to[1] },
});

const room = (subject: string, at: [string, number], roomId: string): ManualOverride => ({
  kind: "room",
  subjectId: subject,
  at: { day: at[0], slot: at[1] },
  roomId,
});

const unplace = (subject: string, at: [string, number]): ManualOverride => ({
  kind: "unplace",
  subjectId: subject,
  at: { day: at[0], slot: at[1] },
});

describe("overridesToPreAssignments", () => {
  it("replaces the pin when the same occurrence is re-moved (chained)", () => {
    const pins = overridesToPreAssignments([
      move("math", ["Mon", 1], ["Tue", 2]),
      move("lab", ["Mon", 3], ["Wed", 1]),
      move("math", ["Tue", 2], ["Fri", 4]),
    ]);
    expect(pins).toEqual([
      { subjectId: "lab", day: "Wed", slot: 1 },
      { subjectId: "math", day: "Fri", slot: 4 },
    ]);
  });

  it("keeps a separate pin for each moved occurrence of one subject (PR #34 R2)", () => {
    const pins = overridesToPreAssignments([
      move("math", ["Mon", 1], ["Tue", 2]),
      move("math", ["Wed", 3], ["Thu", 4]),
    ]);
    expect(pins).toEqual([
      { subjectId: "math", day: "Thu", slot: 4 },
      { subjectId: "math", day: "Tue", slot: 2 },
    ]);
  });

  it("a room change pins its slot with the room (persist = time+room pin)", () => {
    const pins = overridesToPreAssignments([room("math", ["Mon", 1], "r9")]);
    expect(pins).toEqual([{ subjectId: "math", day: "Mon", slot: 1, roomId: "r9" }]);
  });

  it("move-then-room pins the new slot with the room", () => {
    const pins = overridesToPreAssignments([
      move("math", ["Mon", 1], ["Tue", 2]),
      room("math", ["Tue", 2], "r9"),
    ]);
    expect(pins).toEqual([{ subjectId: "math", day: "Tue", slot: 2, roomId: "r9" }]);
  });

  it("room-then-move carries the room to the new pin", () => {
    const pins = overridesToPreAssignments([
      room("math", ["Mon", 1], "r9"),
      move("math", ["Mon", 1], ["Tue", 2]),
    ]);
    expect(pins).toEqual([{ subjectId: "math", day: "Tue", slot: 2, roomId: "r9" }]);
  });

  it("two moved occurrences keep independent rooms", () => {
    const pins = overridesToPreAssignments([
      move("math", ["Mon", 1], ["Tue", 2]),
      room("math", ["Tue", 2], "r1"),
      move("math", ["Wed", 3], ["Thu", 4]),
      room("math", ["Thu", 4], "r2"),
    ]);
    expect(pins).toEqual([
      { subjectId: "math", day: "Thu", slot: 4, roomId: "r2" },
      { subjectId: "math", day: "Tue", slot: 2, roomId: "r1" },
    ]);
  });
});

describe("applyPlan (doc-aware Apply model)", () => {
  const pinnedDoc = { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1, room_id: "r7" }] };

  it("a move off a doc pin marks it stale and carries its room to the destination", () => {
    const { pins, stale } = applyPlan(pinnedDoc, [move("math", ["Mon", 1], ["Tue", 2])]);
    expect(stale).toEqual([{ subjectId: "math", day: "Mon", slot: 1, roomId: "r7" }]);
    expect(pins).toEqual([{ subjectId: "math", day: "Tue", slot: 2, roomId: "r7" }]);
  });

  it("a later room override wins over the doc pin's carried room", () => {
    const { pins, stale } = applyPlan(pinnedDoc, [
      move("math", ["Mon", 1], ["Tue", 2]),
      room("math", ["Tue", 2], "r9"),
    ]);
    expect(stale).toEqual([{ subjectId: "math", day: "Mon", slot: 1, roomId: "r7" }]);
    expect(pins).toEqual([{ subjectId: "math", day: "Tue", slot: 2, roomId: "r9" }]);
  });

  it("moving an unpinned session leaves stale empty (plain destination pin)", () => {
    const { pins, stale } = applyPlan({}, [move("math", ["Mon", 1], ["Tue", 2])]);
    expect(stale).toEqual([]);
    expect(pins).toEqual([{ subjectId: "math", day: "Tue", slot: 2 }]);
  });

  it("a chain that returns to its own doc pin cancels the removal (no doc churn)", () => {
    const { pins, stale } = applyPlan(pinnedDoc, [
      move("math", ["Mon", 1], ["Tue", 2]),
      move("math", ["Tue", 2], ["Mon", 1]),
    ]);
    expect(stale).toEqual([]);
    expect(pins).toEqual([{ subjectId: "math", day: "Mon", slot: 1, roomId: "r7" }]);
    // ...and the upsert is a structural no-op, so Apply has nothing to do.
    expect(applyPins(pinnedDoc, pins)).toBe(pinnedDoc);
  });
});

describe("applyPins / unappliedPinCount (Apply edits)", () => {
  it("upserts every pin into the doc and skips the write when all are present", () => {
    const doc = { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1 }] };
    const pins = [
      { subjectId: "math", day: "Mon", slot: 1 },
      { subjectId: "eng", day: "Tue", slot: 2, roomId: "r1" },
    ];
    const applied = applyPins(doc, pins);
    expect(applied.pre_assignments).toEqual([
      { subject_id: "math", day: "Mon", slot: 1 },
      { subject_id: "eng", day: "Tue", slot: 2, room_id: "r1" },
    ]);
    expect(applyPins(applied, pins)).toBe(applied); // second apply: identity, no doc write
  });

  it("counts the session pins missing from the doc (slot AND room must match)", () => {
    const overrides = [
      move("math", ["Mon", 1], ["Tue", 2]),
      room("math", ["Tue", 2], "r9"),
      move("eng", ["Mon", 3], ["Wed", 1]),
    ];
    expect(unappliedPinCount({}, overrides)).toBe(2);
    const partial = { pre_assignments: [{ subject_id: "eng", day: "Wed", slot: 1 }] };
    expect(unappliedPinCount(partial, overrides)).toBe(1);
    const wrongRoom = {
      pre_assignments: [
        { subject_id: "math", day: "Tue", slot: 2, room_id: "r1" },
        { subject_id: "eng", day: "Wed", slot: 1 },
      ],
    };
    expect(unappliedPinCount(wrongRoom, overrides)).toBe(1);
    const full = {
      pre_assignments: [
        { subject_id: "math", day: "Tue", slot: 2, room_id: "r9" },
        { subject_id: "eng", day: "Wed", slot: 1 },
      ],
    };
    expect(unappliedPinCount(full, overrides)).toBe(0);
  });

  it("counts the room-carrying destination of a moved doc pin (badge clears on Apply)", () => {
    const doc = { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1, room_id: "r7" }] };
    const overrides = [move("math", ["Mon", 1], ["Tue", 2])];
    expect(unappliedPinCount(doc, overrides)).toBe(1);
    const applied = {
      pre_assignments: [{ subject_id: "math", day: "Tue", slot: 2, room_id: "r7" }],
    };
    expect(unappliedPinCount(applied, overrides)).toBe(0);
  });
});

describe("planApplyDoc (the doc a re-run or Apply must submit)", () => {
  it("returns the doc the solve must read: stale pin gone, destination pin on", () => {
    const doc = { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1, room_id: "r7" }] };
    const { next } = planApplyDoc(doc, [move("math", ["Mon", 1], ["Tue", 2])]);
    expect(next.pre_assignments).toEqual([{ subject_id: "math", day: "Tue", slot: 2, room_id: "r7" }]);
  });

  it("keeps doc identity when nothing changes (no-op re-run skips the write)", () => {
    const doc = { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1 }] };
    expect(planApplyDoc(doc, []).next).toBe(doc);
    const roundTrip = [move("math", ["Mon", 1], ["Tue", 2]), move("math", ["Tue", 2], ["Mon", 1])];
    expect(planApplyDoc(doc, roundTrip).next).toBe(doc);
  });
});

describe("pinDiff (edit-history apply payload)", () => {
  const pins = [
    { subjectId: "math", day: "Mon", slot: 1 },
    { subjectId: "eng", day: "Tue", slot: 2, roomId: "r2" },
  ];

  it("splits pins into added and replaced-with-PRIOR-room", () => {
    const doc = { pre_assignments: [{ subject_id: "eng", day: "Tue", slot: 2, room_id: "r1" }] };
    expect(pinDiff(doc, pins)).toEqual({
      added: [{ subjectId: "math", day: "Mon", slot: 1 }],
      replaced: [{ subjectId: "eng", day: "Tue", slot: 2, roomId: "r1" }],
    });
  });

  it("agrees with applyPins on whether anything changes (data contract)", () => {
    const docs = [
      {},
      { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1 }] },
      { pre_assignments: [{ subject_id: "eng", day: "Tue", slot: 2 }] },
      { pre_assignments: [{ subject_id: "eng", day: "Tue", slot: 2, room_id: "r1" }] },
      {
        pre_assignments: [
          { subject_id: "math", day: "Mon", slot: 1 },
          { subject_id: "eng", day: "Tue", slot: 2, room_id: "r2" },
        ],
      },
    ];
    for (const doc of docs) {
      const { added, replaced } = pinDiff(doc, pins);
      expect(applyPins(doc, pins) !== doc).toBe(added.length + replaced.length > 0);
    }
  });

  it("a room-upsert onto a roomless pin records the bare prior (undo re-pins bare)", () => {
    const doc = { pre_assignments: [{ subject_id: "eng", day: "Tue", slot: 2 }] };
    expect(pinDiff(doc, pins).replaced).toEqual([{ subjectId: "eng", day: "Tue", slot: 2 }]);
  });
});

describe("applyPlan + unplace (hand the occurrence back to the scheduler)", () => {
  it("writes no pin for an unplaced session", () => {
    const { pins, stale } = applyPlan({}, [unplace("math", ["Mon", 1])]);
    expect(pins).toEqual([]);
    expect(stale).toEqual([]);
  });

  it("cancels the pin a move chain had landed on that slot", () => {
    const { pins } = applyPlan({}, [move("math", ["Mon", 1], ["Tue", 2]), unplace("math", ["Tue", 2])]);
    expect(pins).toEqual([]);
  });

  it("marks a ROOMLESS doc pin at that occurrence stale (Apply removes it)", () => {
    const doc = { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1 }] };
    const { pins, stale } = applyPlan(doc, [unplace("math", ["Mon", 1])]);
    expect(pins).toEqual([]);
    expect(stale).toEqual([{ subjectId: "math", day: "Mon", slot: 1 }]);
  });

  it("marks a room-carrying doc pin at that occurrence stale", () => {
    const doc = { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1, room_id: "r7" }] };
    const { stale } = applyPlan(doc, [unplace("math", ["Mon", 1])]);
    expect(stale).toEqual([{ subjectId: "math", day: "Mon", slot: 1, roomId: "r7" }]);
  });

  it("leaves another occurrence of the same subject pinned", () => {
    const doc = {
      pre_assignments: [
        { subject_id: "math", day: "Mon", slot: 1 },
        { subject_id: "math", day: "Wed", slot: 3 },
      ],
    };
    const { stale } = applyPlan(doc, [unplace("math", ["Mon", 1])]);
    expect(stale).toEqual([{ subjectId: "math", day: "Mon", slot: 1 }]);
  });

  it("planApplyDoc drops the pin from the doc the scheduler reads", () => {
    const doc = { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1, room_id: "r7" }] };
    const { next } = planApplyDoc(doc, [unplace("math", ["Mon", 1])]);
    expect(next.pre_assignments).toEqual([]);
  });
});

describe("hasUnappliedEdits (the Apply gate)", () => {
  const pinnedDoc = { pre_assignments: [{ subject_id: "math", day: "Mon", slot: 1 }] };

  it("is true for an unplace whose doc pin must come off, though NO pin is written", () => {
    // The regression this guards: unappliedPinCount counts PINS, and an unplace
    // writes none - gating Apply on the count alone leaves the button disabled
    // with a real doc change pending.
    expect(unappliedPinCount(pinnedDoc, [unplace("math", ["Mon", 1])])).toBe(0);
    expect(hasUnappliedEdits(pinnedDoc, [unplace("math", ["Mon", 1])])).toBe(true);
  });

  it("is false when the occurrence carried no doc pin (nothing to write)", () => {
    expect(hasUnappliedEdits({}, [unplace("math", ["Mon", 1])])).toBe(false);
  });

  it("agrees with planApplyDoc's identity rule on the existing verbs", () => {
    expect(hasUnappliedEdits(pinnedDoc, [])).toBe(false);
    expect(hasUnappliedEdits(pinnedDoc, [move("math", ["Mon", 1], ["Tue", 2])])).toBe(true);
    const roundTrip = [move("math", ["Mon", 1], ["Tue", 2]), move("math", ["Tue", 2], ["Mon", 1])];
    expect(hasUnappliedEdits(pinnedDoc, roundTrip)).toBe(false);
  });
});
