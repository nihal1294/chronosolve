import { useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { driver, type Driver, type DriveStep } from "driver.js";

import { anchorSelector, TOUR_STEPS } from "./help-topics";
import { waitForElement } from "./wait-for-element";
import { saveOnboarding, TOUR_VERSION } from "./onboarding-storage";

type NavigateFn = ReturnType<typeof useNavigate>;
type Ref<T> = { current: T };
type KeyHandler = (event: KeyboardEvent) => void;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

function buildSteps(): DriveStep[] {
  return TOUR_STEPS.map((step) => ({
    element: step.anchor ? anchorSelector(step.anchor) : undefined,
    popover: { title: step.title, description: step.body, side: step.side, align: "center" },
  }));
}

/** Navigate to a step's route (if any) and wait for its anchor to mount, so the
 *  element is present before driver highlights it. No-op for non-routed steps. */
async function navigateToStep(navigate: NavigateFn, index: number): Promise<void> {
  const step = TOUR_STEPS[index];
  if (!step?.route) return;
  navigate(step.route);
  if (step.anchor) await waitForElement(anchorSelector(step.anchor));
}

export interface TourDeps {
  navigate: NavigateFn;
  driverRef: Ref<Driver | null>;
  /** Idempotency latch: flips true once this run has ended and persisted. */
  endedRef: Ref<boolean>;
  /** Holds the live ESC handler so a replay can detach it before re-binding. */
  keyHandlerRef: Ref<KeyHandler | null>;
  activeBefore: HTMLElement | null;
}

export interface TourEngine {
  finish: (completed: boolean) => void;
  goNext: () => Promise<void>;
  goPrev: () => Promise<void>;
  onKeyDown: KeyHandler;
}

/** The cross-route navigation engine for one tour run.
 *
 *  Persistence funnels through `finish` and runs BEFORE destroy. Driver's own
 *  onDestroyed only fires after its rAF highlight transition has set an internal
 *  active element, which never happens in a backgrounded tab and can be missed
 *  when the tour is closed mid-transition - so relying on it drops the saved
 *  state. Routing every end (Done, ESC, close button, overlay) through `finish`
 *  makes the record independent of that timing. A re-entrancy latch keeps a
 *  rapid double-click on Next from racing two navigate-then-advance cycles. */
export function createEngine(deps: TourDeps): TourEngine {
  const { navigate, driverRef, endedRef, keyHandlerRef, activeBefore } = deps;
  let navigating = false;

  const finish = (completed: boolean): void => {
    if (endedRef.current) return;
    endedRef.current = true;
    saveOnboarding(window.localStorage, {
      [completed ? "completed" : "skipped"]: true,
      version: TOUR_VERSION,
    });
    if (keyHandlerRef.current) document.removeEventListener("keydown", keyHandlerRef.current);
    keyHandlerRef.current = null;
    const instance = driverRef.current;
    driverRef.current = null;
    instance?.destroy();
    activeBefore?.focus?.();
  };

  const goNext = async (): Promise<void> => {
    const d = driverRef.current;
    if (!d || navigating) return;
    if (d.isLastStep()) return finish(true);
    navigating = true;
    try {
      await navigateToStep(navigate, (d.getActiveIndex() ?? 0) + 1);
      // The tour may have ended (ESC / X / overlay) during the navigation wait;
      // a stale continuation must not advance a run the user already closed.
      if (endedRef.current || driverRef.current !== d) return;
      d.moveNext();
    } finally {
      navigating = false;
    }
  };

  const goPrev = async (): Promise<void> => {
    const d = driverRef.current;
    const prev = (d?.getActiveIndex() ?? 0) - 1;
    if (!d || navigating || prev < 0) return;
    navigating = true;
    try {
      await navigateToStep(navigate, prev);
      if (endedRef.current || driverRef.current !== d) return;
      d.movePrevious();
    } finally {
      navigating = false;
    }
  };

  const onKeyDown: KeyHandler = (event) => {
    if (event.key === "Escape") finish(false);
  };

  return { finish, goNext, goPrev, onKeyDown };
}

/** Build a themed driver instance wired to the cross-route engine. Keyboard nav
 *  is off (arrow keys would bypass the navigate-then-wait); ESC is handled
 *  manually, and the native close paths route through `finish` to persist. */
export function createTour(deps: TourDeps): Driver {
  const reduce = prefersReducedMotion();
  const { finish, goNext, goPrev, onKeyDown } = createEngine(deps);

  const instance = driver({
    showProgress: true,
    allowClose: true,
    allowKeyboardControl: false,
    disableActiveInteraction: true,
    animate: !reduce,
    smoothScroll: !reduce,
    overlayColor: "#0a0a0a",
    overlayOpacity: 0.6,
    popoverClass: "chronosolve-tour",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    steps: buildSteps(),
    onNextClick: () => void goNext(),
    onPrevClick: () => void goPrev(),
    onCloseClick: () => finish(false),
    onDestroyStarted: () => finish(false),
  });
  deps.keyHandlerRef.current = onKeyDown;
  document.addEventListener("keydown", onKeyDown);
  return instance;
}

export interface OnboardingControls {
  /** Start (or replay) the tour from step 1, regardless of completion state.
   *  First-run launch is owned by the welcome card (see `ApplicationShell`), not
   *  an auto-start - the tour is always user-initiated. */
  startTour: () => void;
}

export function useOnboarding(): OnboardingControls {
  const navigate = useNavigate();
  const driverRef = useRef<Driver | null>(null);
  const endedRef = useRef(false);
  const keyHandlerRef = useRef<KeyHandler | null>(null);

  const startTour = useCallback(() => {
    // Tear down any in-flight run without persisting (a replay owns its own
    // outcome): detach its ESC handler first so listeners never accumulate.
    if (keyHandlerRef.current) document.removeEventListener("keydown", keyHandlerRef.current);
    keyHandlerRef.current = null;
    driverRef.current?.destroy();
    driverRef.current = null;
    endedRef.current = false;
    const instance = createTour({
      navigate,
      driverRef,
      endedRef,
      keyHandlerRef,
      activeBefore: document.activeElement as HTMLElement | null,
    });
    driverRef.current = instance;
    instance.drive();
  }, [navigate]);

  return { startTour };
}
