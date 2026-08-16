import { describe, expect, it } from "vitest";
import { saveWarnings } from "./save-warnings";

describe("saveWarnings", () => {
  it("says nothing when the session has no pending edits", () => {
    expect(saveWarnings(0, 0)).toEqual([]);
  });

  it("warns about the pins Apply would write", () => {
    expect(saveWarnings(1, 0)).toEqual([
      "1 session edit is not applied - Apply edits writes them into the problem",
    ]);
    expect(saveWarnings(3, 0)[0]).toContain("3 session edits are not applied");
  });

  it("warns about unplaced sessions, WITHOUT telling anyone to Apply them", () => {
    // The regression this guards: an unplace produces no pin, so a warning
    // gated on the pin count alone stays silent while the edit really does
    // vanish on save. Apply cannot write one either - "un-decided" is the
    // document's default state - so the remedy has to differ.
    const [warning] = saveWarnings(0, 1);
    expect(warning).toContain("1 unplaced session is not saved");
    expect(warning).not.toContain("Apply edits");
  });

  it("pluralizes the unplaced count", () => {
    expect(saveWarnings(0, 2)[0]).toContain("2 unplaced sessions are not saved");
  });

  it("reports both independently when a session carries each", () => {
    const warnings = saveWarnings(2, 1);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("2 session edits are not applied");
    expect(warnings[1]).toContain("1 unplaced session is not saved");
  });
});
