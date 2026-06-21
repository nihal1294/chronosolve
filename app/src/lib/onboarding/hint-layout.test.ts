import { afterEach, describe, expect, it } from "vitest";
import { computeHints, tooltipPosition, type Rect } from "./hint-layout";
import type { HelpTopic } from "./help-topics";

function anchored(id: string, rect: Partial<DOMRect>): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-tour", id);
  el.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, ...rect }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
});

const topic = (over: Partial<HelpTopic> = {}): HelpTopic => ({
  id: "t",
  anchor: "data",
  title: "T",
  blurb: "B",
  hint: true,
  ...over,
});

describe("computeHints", () => {
  it("returns a placement for an on-screen anchor with size", () => {
    anchored("data", { top: 100, left: 50, width: 200, height: 80 });
    const out = computeHints(document, [topic()]);
    expect(out).toHaveLength(1);
    expect(out[0].rect).toEqual({ top: 100, left: 50, width: 200, height: 80 });
  });

  it("skips a topic whose anchor is absent", () => {
    expect(computeHints(document, [topic({ anchor: "solver" })])).toHaveLength(0);
  });

  it("skips a present-but-zero-size anchor (route not rendered)", () => {
    anchored("data", { width: 0, height: 0 });
    expect(computeHints(document, [topic()])).toHaveLength(0);
  });
});

describe("tooltipPosition", () => {
  const rect: Rect = { top: 100, left: 100, width: 60, height: 40 };
  const vp = { width: 1000, height: 800 };

  it("flanks the element on the right for side=right", () => {
    expect(tooltipPosition(rect, "right", vp)).toEqual({ top: 100, left: 172 });
  });

  it("drops below the element by default", () => {
    expect(tooltipPosition(rect, "over", vp)).toEqual({ top: 150, left: 100 });
  });

  it("clamps so the tooltip never spills off the right edge", () => {
    const edge: Rect = { top: 10, left: 950, width: 40, height: 20 };
    expect(tooltipPosition(edge, "right", vp).left).toBe(vp.width - 256 - 8);
  });
});
