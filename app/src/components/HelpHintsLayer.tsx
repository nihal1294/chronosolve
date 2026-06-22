import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useHelpMode } from "../lib/onboarding/help-mode";
import { computeHints, tooltipPosition, type HintPlacement } from "../lib/onboarding/hint-layout";

/** Ambient help overlay. While Help Mode is on, it lights up every help anchor
 *  currently on screen with an indigo dot (the hover target) ringed around the
 *  control, plus a themed tooltip on hover. It is a fixed overlay positioned over
 *  each anchor's bounding rect, so it never disturbs the underlying layout, and
 *  the rings/tooltips are pointer-events-none so the controls stay clickable. */
export function HelpHintsLayer() {
  const on = useHelpMode();
  const location = useLocation();
  const [hints, setHints] = useState<HintPlacement[]>([]);

  useEffect(() => {
    if (!on) {
      // Clear so a later re-enable never flashes stale rects (the overlay
      // renders null while off, but the array would otherwise persist).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHints([]);
      return;
    }
    const recompute = () => setHints(computeHints(document));
    let ticking = false;
    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        recompute();
        ticking = false;
      });
    };
    // Measure on the next frame(s), never synchronously in the effect body, so
    // React isn't re-rendered mid-commit. Anchors for a freshly-navigated route
    // also mount a frame (or a little) later, so this doubles as the route hook.
    const raf = requestAnimationFrame(recompute);
    const settle = window.setTimeout(recompute, 120);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [on, location.pathname]);

  if (!on) return null;
  const vp = { width: window.innerWidth, height: window.innerHeight };

  return (
    // Purely visual help layer over already-accessible controls: hidden from
    // assistive tech so the hover-only tooltips aren't announced as stray text.
    <div className="fixed inset-0 z-[90] pointer-events-none" aria-hidden="true">
      {hints.map((hint) => {
        const tip = tooltipPosition(hint.rect, hint.side, vp);
        return (
          <div key={hint.id} className="group">
            <div
              className="fixed rounded-lg ring-2 ring-indigo-500/40 pointer-events-none"
              style={{
                top: hint.rect.top,
                left: hint.rect.left,
                width: hint.rect.width,
                height: hint.rect.height,
              }}
            />
            <div
              className="fixed h-3 w-3 cursor-help rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.85)] animate-pulse pointer-events-auto"
              style={{ top: hint.rect.top - 5, left: hint.rect.left + hint.rect.width - 7 }}
              aria-hidden="true"
            />
            <div
              role="tooltip"
              className="fixed w-64 rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-xl opacity-0 transition-opacity duration-150 group-hover:opacity-100 pointer-events-none dark:border-neutral-800 dark:bg-neutral-900"
              style={{ top: tip.top, left: tip.left }}
            >
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {hint.title}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {hint.blurb}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
