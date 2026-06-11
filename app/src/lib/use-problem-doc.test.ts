import { describe, expect, it } from "vitest";
import { tryParseDoc } from "./use-problem-doc";

describe("tryParseDoc", () => {
  it("treats blank text as no document, without raising an error", () => {
    expect(tryParseDoc("")).toEqual({ doc: null, parseError: null });
    expect(tryParseDoc("  \n\t")).toEqual({ doc: null, parseError: null });
  });

  it("reduces parse failures to a one-line message for the editor badge", () => {
    const invalid = tryParseDoc("a: [unclosed");
    expect(invalid.doc).toBeNull();
    expect(invalid.parseError).toBeTruthy();
    expect(invalid.parseError).not.toContain("\n");
  });

  it("rejects non-mapping documents and parses mappings into a doc", () => {
    expect(tryParseDoc("- just\n- a list\n").parseError).toMatch(/mapping/i);
    expect(tryParseDoc("subjects: []").doc).toEqual({ subjects: [] });
  });
});
