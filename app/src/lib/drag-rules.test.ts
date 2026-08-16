import { describe, expect, it } from "vitest";
import { canDropSession, sessionDragItem, type DragItem } from "./drag-rules";
import { scheduleKey } from "./grid";
import type { ScheduleEntry } from "./solver-client";

const entry: ScheduleEntry = {
  subject_id: "lab",
  day: "Mon",
  slot: 1,
  teacher_ids: ["t1"],
  group_ids: ["g1"],
  room_id: null,
};

const item = (size: number, anchorDay = "Mon", anchorSlot = 1): DragItem => ({
  entry,
  anchorDay,
  anchorSlot,
  size,
});

const EMPTY = new Set<string>();
const occupiedBy = (...keys: [string, string, number][]) =>
  new Set(keys.map(([subject, day, slot]) => scheduleKey(subject, day, slot)));

describe("canDropSession", () => {
  it("rejects a block that would overflow the day's last slot", () => {
    expect(canDropSession(item(2), { day: "Tue", slot: 4 }, 4, EMPTY)).toBe(false);
    expect(canDropSession(item(2), { day: "Tue", slot: 3 }, 4, EMPTY)).toBe(true);
  });

  it("rejects dropping a block onto its own anchor", () => {
    expect(canDropSession(item(1), { day: "Mon", slot: 1 }, 4, EMPTY)).toBe(false);
    expect(canDropSession(item(1), { day: "Mon", slot: 2 }, 4, EMPTY)).toBe(true);
  });

  it("accepts a slot another SUBJECT holds (conflicts flag, never block)", () => {
    const occupied = occupiedBy(["math", "Tue", 1]);
    expect(canDropSession(item(1), { day: "Tue", slot: 1 }, 4, occupied)).toBe(true);
  });
});

describe("canDropSession - one session per subject per slot", () => {
  // The solver models ONE boolean per (subject, day, slot) and pre_assignments
  // key on that same triple, so two occurrences of a subject sharing a slot is
  // a state neither a solve nor the problem file can represent. This is the
  // only place it could be created, so it is refused here rather than left for
  // the anchor maths and the pin plan to disagree about downstream.
  it("refuses a drop onto a slot another occurrence of the same subject holds", () => {
    const occupied = occupiedBy(["lab", "Tue", 1]);
    expect(canDropSession(item(1), { day: "Tue", slot: 1 }, 4, occupied)).toBe(false);
  });

  it("checks every slot the dropped block would cover, not just its anchor", () => {
    const occupied = occupiedBy(["lab", "Tue", 3]);
    expect(canDropSession(item(2), { day: "Tue", slot: 2 }, 4, occupied)).toBe(false);
  });

  it("lets a block slide within its own footprint (its hours are what is moving)", () => {
    // The 1-2 block sliding to 2-3: slot 2 is its own hour, not another
    // occurrence, so the overlap that would make the anchor run ambiguous
    // never arises from a self-slide.
    const occupied = occupiedBy(["lab", "Mon", 1], ["lab", "Mon", 2]);
    expect(canDropSession(item(2), { day: "Mon", slot: 2 }, 4, occupied)).toBe(true);
  });

  it("refuses the partial overlap that would make the block anchor ambiguous", () => {
    // Two 2-slot blocks at 1-2 and 3-4; dragging the first to 2-3 would tile
    // an occupied run of 2,3,3,4 that blockAnchor cannot decompose.
    const occupied = occupiedBy(["lab", "Mon", 1], ["lab", "Mon", 2], ["lab", "Mon", 3], ["lab", "Mon", 4]);
    expect(canDropSession(item(2), { day: "Mon", slot: 2 }, 4, occupied)).toBe(false);
  });
});

describe("sessionDragItem", () => {
  const at = (subject: string, day: string, slot: number): ScheduleEntry => ({
    subject_id: subject,
    day,
    slot,
    teacher_ids: ["t1"],
    group_ids: ["g1"],
    room_id: null,
  });

  it("refuses to drag a pinned session", () => {
    const e = at("math", "Mon", 1);
    expect(sessionDragItem(e, new Set(["math|Mon|1"]), [e], new Map())).toBeNull();
  });

  it("carries the block anchor and size, whichever covered slot is grabbed", () => {
    const display = [at("lab", "Mon", 1), at("lab", "Mon", 2)];
    const blocks = new Map([["lab", 2]]);
    expect(sessionDragItem(display[1], new Set(), display, blocks)).toEqual({
      entry: display[1],
      anchorDay: "Mon",
      anchorSlot: 1,
      size: 2,
    });
  });
});
