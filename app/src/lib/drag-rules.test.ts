import { describe, expect, it } from "vitest";
import { canDropSession, sessionDragItem, type DragItem } from "./drag-rules";
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

describe("canDropSession", () => {
  it("rejects a block that would overflow the day's last slot", () => {
    expect(canDropSession(item(2), "Tue", 4, 4)).toBe(false);
    expect(canDropSession(item(2), "Tue", 3, 4)).toBe(true);
  });

  it("rejects dropping a block onto its own anchor", () => {
    expect(canDropSession(item(1), "Mon", 1, 4)).toBe(false);
    expect(canDropSession(item(1), "Mon", 2, 4)).toBe(true);
  });

  it("accepts an in-range slot regardless of occupancy (conflicts flag, never block)", () => {
    // The signature has no occupancy input by design - a legal-geometry drop
    // always lands, and the conflict checker paints what broke.
    expect(canDropSession(item(1), "Tue", 1, 4)).toBe(true);
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
