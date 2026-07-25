import { describe, expect, it } from "vitest";
import { slotTimes } from "./slot-times";

describe("slotTimes", () => {
  it("parses a 'H:MM - H:MM' slot label into start and end", () => {
    expect(slotTimes(1, { 1: "9:00 - 9:55" })).toEqual({ start: [9, 0], end: [9, 55] });
  });

  it("parses 24-hour afternoon labels", () => {
    expect(slotTimes(5, { 5: "14:10 - 15:05" })).toEqual({ start: [14, 10], end: [15, 5] });
  });

  it("tolerates missing spaces around the dash", () => {
    expect(slotTimes(2, { 2: "10:00-10:55" })).toEqual({ start: [10, 0], end: [10, 55] });
  });

  it("falls back to synthetic 55-minute periods on the hour from 08:00", () => {
    expect(slotTimes(1, {})).toEqual({ start: [8, 0], end: [8, 55] });
    expect(slotTimes(3, {})).toEqual({ start: [10, 0], end: [10, 55] });
  });

  it("falls back when the label exists but is not a time range", () => {
    expect(slotTimes(2, { 2: "Period two" })).toEqual({ start: [9, 0], end: [9, 55] });
  });

  it("falls back when a label's range ends at or before it starts", () => {
    expect(slotTimes(2, { 2: "10:00 - 09:00" })).toEqual({ start: [9, 0], end: [9, 55] });
    expect(slotTimes(2, { 2: "10:00 - 10:00" })).toEqual({ start: [9, 0], end: [9, 55] });
  });

  it("falls back when a label's numbers are out of range for a time of day", () => {
    expect(slotTimes(2, { 2: "24:00 - 25:00" })).toEqual({ start: [9, 0], end: [9, 55] });
    expect(slotTimes(2, { 2: "09:99 - 10:99" })).toEqual({ start: [9, 0], end: [9, 55] });
  });

  it("keeps the hourly cadence for a day that fits in the hours from 08:00", () => {
    expect(slotTimes(1, {}, 8)).toEqual({ start: [8, 0], end: [8, 55] });
    expect(slotTimes(16, {}, 16)).toEqual({ start: [23, 0], end: [23, 55] });
  });

  it("starts an unlabeled slot after its labeled neighbour rather than colliding", () => {
    const labels = { 1: "09:00 - 09:55" };
    expect(slotTimes(1, labels, 6)).toEqual({ start: [9, 0], end: [9, 55] });
    expect(slotTimes(2, labels, 6)).toEqual({ start: [10, 0], end: [10, 55] });
  });

  it("resumes from the day start when the labels begin later", () => {
    expect(slotTimes(1, { 2: "09:00 - 09:55" }, 6)).toEqual({ start: [8, 0], end: [8, 55] });
  });

  it("compresses the fallback so a long day keeps every slot distinct and valid", () => {
    const times = [16, 17, 18, 19, 20].map((slot) => slotTimes(slot, {}, 20));
    const starts = times.map(({ start }) => start[0] * 60 + start[1]);
    expect(new Set(starts).size).toBe(starts.length);
    expect([...starts]).toEqual([...starts].sort((a, b) => a - b));
    for (const { start, end } of times) {
      expect(end[0]).toBeLessThanOrEqual(23);
      expect(end[0] * 60 + end[1]).toBeGreaterThan(start[0] * 60 + start[1]);
    }
  });
});
