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

  it("shares out the time a labeled slot leaves rather than the whole day", () => {
    // Slot 1's label starts an hour after the day would, so the 19 slots after
    // it have less room than an even split of 08:00-midnight assumes. Splitting
    // the whole day runs the last of them into each other at the clamp.
    const times = [17, 18, 19, 20].map((slot) => slotTimes(slot, { 1: "09:00 - 09:55" }, 20));
    const minutes = ([hour, minute]: [number, number]) => hour * 60 + minute;
    for (const [index, { end }] of times.slice(0, -1).entries()) {
      expect(minutes(end)).toBeLessThanOrEqual(minutes(times[index + 1].start));
    }
  });

  // Broad guard: the fallback arithmetic has sprung a leak at each of the day's
  // edges in turn (invalid hours, a shared 23:00, then overlap after a label),
  // so sweep the shapes rather than adding one case per leak. The exhausted day
  // - a label that itself runs to 23:59 - is left out on purpose: no time is
  // left to share out, and a slot may not spill past midnight.
  it("keeps every slot ordered, non-overlapping and a real time of day", () => {
    const shapes: Record<number, string>[] = [
      {},
      { 1: "08:00 - 08:55" },
      { 1: "09:00 - 09:55" },
      { 1: "12:00 - 12:55" },
      { 1: "20:00 - 20:55" },
      { 5: "14:00 - 14:55" },
      { 1: "09:00 - 09:55", 4: "13:00 - 13:55" },
    ];
    const minutes = ([hour, minute]: [number, number]) => hour * 60 + minute;
    const broken: string[] = [];
    for (const [shape, labels] of shapes.entries()) {
      for (const count of [1, 6, 8, 12, 16, 17, 20, 24, 30]) {
        const times = Array.from({ length: count }, (_, i) => slotTimes(i + 1, labels, count));
        times.forEach((time, index) => {
          const at = `shape ${shape}/${count} slots/slot ${index + 1}`;
          if (minutes(time.end) <= minutes(time.start)) broken.push(`${at}: ends before it starts`);
          if (time.end[0] > 23) broken.push(`${at}: past midnight`);
          if (index > 0 && minutes(times[index - 1].end) > minutes(time.start)) {
            broken.push(`${at}: overlaps the slot before it`);
          }
        });
      }
    }
    expect(broken.slice(0, 10)).toEqual([]);
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
