import { afterEach, describe, expect, it } from "vitest";
import { clampRectToViewport, computeHints, tooltipPosition, type Rect } from "./hint-layout";
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

describe("clampRectToViewport", () => {
  const vp = { width: 1000, height: 800 };

  it("leaves a small in-viewport rect untouched so the ring still hugs it", () => {
    const r: Rect = { top: 100, left: 50, width: 200, height: 80 };
    expect(clampRectToViewport(r, vp)).toEqual(r);
  });

  it("pulls an oversized rect's far edges in to the viewport margin", () => {
    // Taller and wider than the screen, spilling past the right and bottom.
    const huge: Rect = { top: 40, left: 30, width: 5000, height: 5000 };
    expect(clampRectToViewport(huge, vp, 8)).toEqual({
      top: 40,
      left: 30,
      width: vp.width - 8 - 30,
      height: vp.height - 8 - 40,
    });
  });

  it("pulls a rect that starts off the top-left edge in to the margin", () => {
    const off: Rect = { top: -200, left: -100, width: 400, height: 400 };
    expect(clampRectToViewport(off, vp, 8)).toEqual({
      top: 8,
      left: 8,
      width: 400 - 100 - 8,
      height: 400 - 200 - 8,
    });
  });

  it("collapses an anchor scrolled fully out to zero size (caller drops it)", () => {
    const above: Rect = { top: -500, left: 50, width: 200, height: 300 };
    const out = clampRectToViewport(above, vp);
    expect(out.height).toBe(0);
  });
});
