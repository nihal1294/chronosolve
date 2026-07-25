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

  it("clamps the synthetic fallback so late slots stay a valid time of day", () => {
    expect(slotTimes(16, {})).toEqual({ start: [23, 0], end: [23, 55] });
    expect(slotTimes(20, {})).toEqual({ start: [23, 0], end: [23, 55] });
  });
});
