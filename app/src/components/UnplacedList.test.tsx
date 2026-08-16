import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { UnplacedList } from "./UnplacedList";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const ROWS = [
  { index: 1, label: "Mathematics - was Wed 09:00 - 09:55" },
  { index: 3, label: "Physics Lab - was Thu slot 2" },
];

describe("UnplacedList", () => {
  it("renders nothing when nothing is unplaced", () => {
    act(() => root.render(<UnplacedList rows={[]} onPutBack={() => {}} />));
    expect(container.textContent).toBe("");
  });

  it("lists every unplaced session with a count", () => {
    act(() => root.render(<UnplacedList rows={ROWS} onPutBack={() => {}} />));
    expect(container.textContent).toContain("Unplaced (2)");
    expect(container.textContent).toContain("Mathematics - was Wed 09:00 - 09:55");
    expect(container.textContent).toContain("Physics Lab - was Thu slot 2");
  });

  it("puts back the row's OWN log index, not its position in the list", () => {
    const onPutBack = vi.fn();
    act(() => root.render(<UnplacedList rows={ROWS} onPutBack={onPutBack} />));
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    act(() => buttons[1].click());
    expect(onPutBack).toHaveBeenCalledWith(3);
  });
});
