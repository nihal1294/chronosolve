import { describe, expect, it } from "vitest";
import { getAdvancedList, getSoftWeight, type ProblemDoc } from "./problem-doc";
import {
  addSoftened,
  DEFAULT_SOFT_WEIGHT,
  getSoftened,
  isSoftened,
  removeIndexKeyedRule,
  removeSoftened,
  softenedIndex,
  unsoftenedIndex,
  weightKeyFor,
} from "./soften";

const docWith = (advanced: Record<string, unknown>, soft: Record<string, unknown> = {}): ProblemDoc => ({
  constraints: { soft, advanced },
});

const BREAKS = [
  { day: "Mon", slots: [1] },
  { day: "Tue", slots: [2] },
  { day: "Wed", slots: [3] },
];

describe("softened accessors", () => {
  it("reads [] when unset and drops malformed entries", () => {
    expect(getSoftened({})).toEqual([]);
    const doc = docWith({ softened: [{ kind: "break", key: "0" }, "junk", { kind: 3 }] });
    expect(getSoftened(doc)).toEqual([{ kind: "break", key: "0" }]);
  });

  it("weightKeyFor is the uniform soft_<kind> backend contract", () => {
    expect(weightKeyFor("break")).toBe("soft_break");
    expect(weightKeyFor("teacher_cap")).toBe("soft_teacher_cap");
  });

  it("addSoftened appends the ref and seeds the kind's weight", () => {
    const next = addSoftened({}, { kind: "break", key: "0" });
    expect(isSoftened(next, "break", "0")).toBe(true);
    expect(getSoftWeight(next, "soft_break")).toBe(DEFAULT_SOFT_WEIGHT);
  });

  it("addSoftened keeps an existing non-zero weight", () => {
    const doc = docWith({}, { soft_break: 80 });
    expect(getSoftWeight(addSoftened(doc, { kind: "break", key: "1" }), "soft_break")).toBe(80);
  });

  it("addSoftened is a no-op when the ref is already softened", () => {
    const doc = addSoftened({}, { kind: "same_day", key: "0" });
    expect(getAdvancedList(addSoftened(doc, { kind: "same_day", key: "0" }), "softened")).toHaveLength(1);
  });

  it("removeSoftened drops only the matching ref", () => {
    const doc = addSoftened(addSoftened({}, { kind: "break", key: "0" }), { kind: "ordering", key: "0" });
    const next = removeSoftened(doc, { kind: "break", key: "0" });
    expect(isSoftened(next, "break", "0")).toBe(false);
    expect(isSoftened(next, "ordering", "0")).toBe(true);
  });

  it("isSoftened matches on kind AND key", () => {
    const doc = addSoftened({}, { kind: "break", key: "1" });
    expect(isSoftened(doc, "break", "0")).toBe(false);
    expect(isSoftened(doc, "ordering", "1")).toBe(false);
  });
});

describe("removeIndexKeyedRule", () => {
  it("removes the entry, drops its ref, and shifts higher refs down", () => {
    const doc = docWith({
      global_breaks: BREAKS,
      softened: [
        { kind: "break", key: "0" },
        { kind: "break", key: "2" },
      ],
    });
    const next = removeIndexKeyedRule(doc, "global_breaks", "break", 0);
    expect(getAdvancedList(next, "global_breaks")).toEqual([BREAKS[1], BREAKS[2]]);
    // old key "2" now addresses the entry at index 1; old key "0" is gone
    expect(getSoftened(next)).toEqual([{ kind: "break", key: "1" }]);
  });

  it("leaves other kinds' refs untouched", () => {
    const doc = docWith({
      global_breaks: BREAKS,
      softened: [{ kind: "ordering", key: "2" }],
    });
    const next = removeIndexKeyedRule(doc, "global_breaks", "break", 1);
    expect(getSoftened(next)).toEqual([{ kind: "ordering", key: "2" }]);
  });

  it("out-of-range index is a no-op", () => {
    const doc = docWith({ global_breaks: BREAKS });
    expect(removeIndexKeyedRule(doc, "global_breaks", "break", 9)).toBe(doc);
  });
});

describe("card-index <-> list-index maps", () => {
  const doc = docWith({
    global_breaks: BREAKS,
    softened: [{ kind: "break", key: "1" }],
  });

  it("unsoftenedIndex maps hard-card positions to original indices", () => {
    expect(unsoftenedIndex(doc, "global_breaks", "break", 0)).toBe(0);
    expect(unsoftenedIndex(doc, "global_breaks", "break", 1)).toBe(2);
    expect(unsoftenedIndex(doc, "global_breaks", "break", 2)).toBe(-1);
  });

  it("softenedIndex maps soft-card positions to original indices", () => {
    expect(softenedIndex(doc, "global_breaks", "break", 0)).toBe(1);
    expect(softenedIndex(doc, "global_breaks", "break", 1)).toBe(-1);
  });
});
