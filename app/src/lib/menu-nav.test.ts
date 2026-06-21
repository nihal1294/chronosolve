import { describe, expect, it } from "vitest";
import { nextItemIndex } from "./menu-nav";

describe("nextItemIndex", () => {
  const sel = [true, false, true, true]; // index 1 is a divider

  it("steps forward, skipping dividers", () => {
    expect(nextItemIndex(sel, 0, 1)).toBe(2);
  });
  it("wraps forward to the first item", () => {
    expect(nextItemIndex(sel, 3, 1)).toBe(0);
  });
  it("steps backward, skipping dividers", () => {
    expect(nextItemIndex(sel, 2, -1)).toBe(0);
  });
  it("wraps backward to the last item", () => {
    expect(nextItemIndex(sel, 0, -1)).toBe(3);
  });
  it("from -1 forward gives the first item (Home)", () => {
    expect(nextItemIndex(sel, -1, 1)).toBe(0);
  });
  it("from length backward gives the last item (End)", () => {
    expect(nextItemIndex(sel, sel.length, -1)).toBe(3);
  });
  it("returns `from` when nothing is selectable", () => {
    expect(nextItemIndex([false, false], 0, 1)).toBe(0);
  });
});
