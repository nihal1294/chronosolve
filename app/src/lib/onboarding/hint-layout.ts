import type { Side } from "driver.js";
import { anchorSelector, type HelpTopic } from "./help-topics";
import { HINT_TOPICS } from "./hint-topics";

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface HintPlacement {
  id: string;
  title: string;
  blurb: string;
  side?: Side;
  rect: Rect;
}

export interface Viewport {
  width: number;
  height: number;
}

type Queryable = Pick<Document, "querySelector">;

/** Resolve each hint topic to its on-screen anchor rect. Topics whose anchor is
 *  absent or has zero size (not rendered on the current route) are skipped, so
 *  the layer only ever shows hints for what is actually visible right now. */
export function computeHints(root: Queryable, topics: HelpTopic[] = HINT_TOPICS): HintPlacement[] {
  const out: HintPlacement[] = [];
  for (const topic of topics) {
    if (!topic.anchor) continue;
    const el = root.querySelector(anchorSelector(topic.anchor));
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    out.push({
      id: topic.id,
      title: topic.title,
      blurb: topic.blurb,
      side: topic.side,
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
    });
  }
  return out;
}

/** Where a hint's tooltip sits relative to its anchor, clamped into the viewport
 *  so it never spills off-screen. `right`/`left` flank the element; everything
 *  else drops below it. */
export function tooltipPosition(
  rect: Rect,
  side: Side | undefined,
  vp: Viewport,
  tipW = 256,
  tipH = 104,
): { top: number; left: number } {
  let top: number;
  let left: number;
  if (side === "right") {
    left = rect.left + rect.width + 12;
    top = rect.top;
  } else if (side === "left") {
    left = rect.left - tipW - 12;
    top = rect.top;
  } else {
    top = rect.top + rect.height + 10;
    left = rect.left;
  }
  left = Math.max(8, Math.min(left, vp.width - tipW - 8));
  top = Math.max(8, Math.min(top, vp.height - tipH - 8));
  return { top: Math.round(top), left: Math.round(left) };
}

/** Pull a hint's ring rect inside the viewport by `margin` px so every edge
 *  stays on screen even when the anchor is taller/wider than the window or flush
 *  to an edge (the timetable grid, the full-height sidebar). A small anchor that
 *  already fits is returned unchanged - the ring still hugs it exactly. An anchor
 *  scrolled fully out collapses to zero size, which the caller drops. */
export function clampRectToViewport(rect: Rect, vp: Viewport, margin = 8): Rect {
  const left = Math.max(margin, rect.left);
  const top = Math.max(margin, rect.top);
  const right = Math.min(vp.width - margin, rect.left + rect.width);
  const bottom = Math.min(vp.height - margin, rect.top + rect.height);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
