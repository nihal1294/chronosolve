/** Durable, versioned completion state for the first-run product tour.
 *
 *  Pure load/save plus the auto-start decision, with the storage backend
 *  injected (any `getItem`/`setItem` surface) so the logic is testable without
 *  touching real localStorage. Bump TOUR_VERSION only when the tour changes
 *  materially - that re-triggers it once for users who already finished it. */

/** Bump only on a meaningful tour change to re-trigger it once. */
export const TOUR_VERSION = 1;

const KEY = "chronosolve.onboarding";

export interface OnboardingState {
  completed?: boolean;
  skipped?: boolean;
  /** The first-run welcome card has been shown (and dismissed) once. */
  welcomed?: boolean;
  version: number;
}

/** The slice of the Web Storage API this module needs (window.localStorage fits). */
export interface StoreLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Read persisted state; returns null when absent or unparseable. */
export function loadOnboarding(store: StoreLike): OnboardingState | null {
  const raw = store.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OnboardingState;
    return typeof parsed?.version === "number" ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist state; returns the same store for call chaining. */
export function saveOnboarding(store: StoreLike, state: OnboardingState): StoreLike {
  store.setItem(KEY, JSON.stringify(state));
  return store;
}

/** Show the first-run welcome card only to a genuinely new user - one with no
 *  stored onboarding record at all. Anyone already welcomed, or who completed or
 *  skipped the tour (including users from before the welcome card existed), is
 *  past onboarding and must not be greeted again. */
export function shouldShowWelcome(state: OnboardingState | null): boolean {
  if (!state) return true;
  return !(state.welcomed || state.completed || state.skipped);
}

/** Record that the welcome card has been shown, preserving any existing tour
 *  outcome so a later decision still sees a completed/skipped run. */
export function markWelcomed(store: StoreLike): void {
  const prior = loadOnboarding(store) ?? { version: TOUR_VERSION };
  saveOnboarding(store, { ...prior, welcomed: true });
}
