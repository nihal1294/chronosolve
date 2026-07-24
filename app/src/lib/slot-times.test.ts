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
});
