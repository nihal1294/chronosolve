import { describe, expect, it } from "vitest";

import { hasWorkspaceContent } from "./use-workspace-doc";
import type { ProblemDoc } from "./problem-doc";

// Minimal stand-in: hasWorkspaceContent only checks identity (non-null) and the
// raw text, never the doc's shape.
const someDoc = {} as ProblemDoc;

describe("hasWorkspaceContent (first-run bootstrap guard)", () => {
  it("is content when a parsed doc exists", () => {
    expect(hasWorkspaceContent(someDoc, "")).toBe(true);
  });

  it("is content when a malformed-YAML draft exists (doc null, text non-empty)", () => {
    // The regression Codex caught: doc stays null for unparseable YAML, but the
    // text is a savable draft the bootstrap must not overwrite.
    expect(hasWorkspaceContent(null, "teachers: [oops")).toBe(true);
  });

  it("is empty for no doc and blank/whitespace text", () => {
    expect(hasWorkspaceContent(null, "")).toBe(false);
    expect(hasWorkspaceContent(null, "   \n\t ")).toBe(false);
  });
});
