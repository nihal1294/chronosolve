import { describe, expect, it } from "vitest";
import {
  IMPORTANCE_BANDS,
  PRESETS,
  PRESET_NAMES,
  bandLabel,
  importanceToWeight,
  weightToImportance,
} from "./constraint-importance";

describe("importance mapping", () => {
  it("snaps each band weight to its own index", () => {
    IMPORTANCE_BANDS.forEach((band, index) => {
      expect(weightToImportance(band.weight)).toBe(index);
    });
  });

  it("snaps an off-stop weight to the nearest band", () => {
    expect(weightToImportance(65)).toBe(3); // closer to 75 (Strong) than 50
    expect(weightToImportance(10)).toBe(0); // closer to 0 (Ignore) than 25
  });

  it("round-trips band index -> weight -> index", () => {
    IMPORTANCE_BANDS.forEach((_, index) => {
      expect(weightToImportance(importanceToWeight(index))).toBe(index);
    });
  });

  it("labels a raw weight by its nearest band", () => {
    expect(bandLabel(75)).toBe("Strong");
    expect(bandLabel(0)).toBe("Ignore");
  });
});

describe("presets", () => {
  it("defines a weight for all 10 soft constraints in every preset", () => {
    const keys = Object.keys(PRESETS.Balanced);
    expect(keys).toHaveLength(10);
    PRESET_NAMES.forEach((name) => {
      expect(Object.keys(PRESETS[name])).toEqual(keys);
    });
  });

  it("uses only canonical band weights", () => {
    const stops = IMPORTANCE_BANDS.map((band) => band.weight);
    PRESET_NAMES.forEach((name) => {
      Object.values(PRESETS[name]).forEach((weight) => expect(stops).toContain(weight));
    });
  });
});
