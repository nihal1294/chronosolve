import { describe, expect, it } from "vitest";
import { blockHue } from "./block-hue";

describe("blockHue", () => {
  it("conflict wins over locked (v26: red pulsing conflict block)", () => {
    expect(blockHue(true, true)).toBe("rose");
    expect(blockHue(true, false)).toBe("rose");
  });

  it("locked wins over standard", () => {
    expect(blockHue(false, true)).toBe("indigo");
  });

  it("defaults to the standard teal placement", () => {
    expect(blockHue(false, false)).toBe("teal");
  });
});
