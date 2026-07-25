import { describe, expect, it } from "vitest";
import { fileSlug, skipNote } from "./export-naming";

describe("fileSlug", () => {
  it("slugs an ordinary name to lowercase words", () => {
    expect(fileSlug("Dr. Smith", "t1")).toBe("dr-smith");
    expect(fileSlug("Class 9A", "g1")).toBe("class-9a");
  });

  it("keeps a name written in another script instead of emptying it", () => {
    expect(fileSlug("张伟", "t1")).toBe("张伟");
    expect(fileSlug("1年A組", "g1")).toBe("1年a組");
  });

  it("falls back so the suggestion is never a bare extension", () => {
    expect(fileSlug("???", "t1")).toBe("t1");
    expect(fileSlug("???", "!!!")).toBe("calendar");
  });
});

describe("skipNote", () => {
  it("says nothing when the calendar carried everything", () => {
    expect(skipNote([], [])).toBe("");
  });

  it("names both kinds of omission in one note", () => {
    expect(skipNote(["Funday"], [2, 3])).toBe(
      " (skipped unrecognized days: Funday; slots with no time left in the day: 2, 3)",
    );
  });

  it("names only the kind that occurred", () => {
    expect(skipNote(["Funday"], [])).toBe(" (skipped unrecognized days: Funday)");
    expect(skipNote([], [4])).toBe(" (skipped slots with no time left in the day: 4)");
  });
});
