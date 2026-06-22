import { afterEach, describe, expect, it } from "vitest";
import { isHelpMode, setHelpMode, toggleHelpMode } from "./help-mode";

afterEach(() => document.body.classList.remove("help-mode-active"));

describe("help-mode", () => {
  it("setHelpMode drives the body flag both ways", () => {
    setHelpMode(true);
    expect(isHelpMode()).toBe(true);
    expect(document.body.classList.contains("help-mode-active")).toBe(true);
    setHelpMode(false);
    expect(isHelpMode()).toBe(false);
  });

  it("toggleHelpMode flips the current state", () => {
    expect(isHelpMode()).toBe(false);
    toggleHelpMode();
    expect(isHelpMode()).toBe(true);
    toggleHelpMode();
    expect(isHelpMode()).toBe(false);
  });
});
