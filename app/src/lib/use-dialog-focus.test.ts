import { describe, expect, it, vi } from "vitest";
import { trapTabFocus } from "./use-dialog-focus";

/** Build a dialog container (focusable via tabIndex -1) holding a single close
    button, attached to the document so focus() actually moves activeElement. */
function setup() {
  document.body.replaceChildren();
  const container = document.createElement("div");
  container.tabIndex = -1;
  const button = document.createElement("button");
  button.textContent = "Close";
  container.appendChild(button);
  document.body.appendChild(container);
  return { container, button };
}

function tab(shiftKey: boolean) {
  return { key: "Tab", shiftKey, preventDefault: vi.fn() };
}

describe("trapTabFocus", () => {
  it("Shift+Tab from the container wraps inward instead of escaping (Codex P3)", () => {
    const { container, button } = setup();
    container.focus();
    expect(document.activeElement).toBe(container);
    const event = tab(true);
    trapTabFocus(event, container);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(button);
  });

  it("Tab from the container wraps to the first focusable", () => {
    const { container, button } = setup();
    container.focus();
    const event = tab(false);
    trapTabFocus(event, container);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(button);
  });

  it("keeps focus on the sole focusable element in both directions", () => {
    const { container, button } = setup();
    button.focus();
    const forward = tab(false);
    trapTabFocus(forward, container);
    expect(forward.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(button);
    const backward = tab(true);
    trapTabFocus(backward, container);
    expect(backward.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(button);
  });

  it("ignores non-Tab keys", () => {
    const { container } = setup();
    const event = { key: "Escape", shiftKey: false, preventDefault: vi.fn() };
    trapTabFocus(event, container);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
