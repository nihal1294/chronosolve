import { describe, expect, test } from "vitest";

import {
  loadOnboarding,
  markWelcomed,
  saveOnboarding,
  shouldShowWelcome,
  TOUR_VERSION,
  type StoreLike,
} from "./onboarding-storage";

/** Fresh in-memory store per test so cases never share state (and never touch
 *  the real localStorage). Satisfies the StoreLike surface the module reads. */
function makeStore(): StoreLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe("onboarding-storage", () => {
  test("a brand-new user is shown the welcome card", () => {
    expect(shouldShowWelcome(loadOnboarding(makeStore()))).toBe(true);
  });

  test("a welcomed user is not greeted again", () => {
    const store = saveOnboarding(makeStore(), { welcomed: true, version: TOUR_VERSION });
    expect(shouldShowWelcome(loadOnboarding(store))).toBe(false);
  });

  test("a user who already completed the tour is never greeted (migration)", () => {
    const store = saveOnboarding(makeStore(), { completed: true, version: TOUR_VERSION });
    expect(shouldShowWelcome(loadOnboarding(store))).toBe(false);
  });

  test("a user who skipped the tour is never greeted", () => {
    const store = saveOnboarding(makeStore(), { skipped: true, version: TOUR_VERSION });
    expect(shouldShowWelcome(loadOnboarding(store))).toBe(false);
  });

  test("corrupt stored JSON loads as null and the welcome shows", () => {
    const store = makeStore();
    store.setItem("chronosolve.onboarding", "{not valid json");
    expect(loadOnboarding(store)).toBeNull();
    expect(shouldShowWelcome(loadOnboarding(store))).toBe(true);
  });

  test("markWelcomed sets the flag without erasing a prior tour outcome", () => {
    const store = saveOnboarding(makeStore(), { completed: true, version: TOUR_VERSION });
    markWelcomed(store);
    expect(loadOnboarding(store)).toEqual({ completed: true, welcomed: true, version: TOUR_VERSION });
  });

  test("markWelcomed on a fresh store records welcomed at the current version", () => {
    const store = makeStore();
    markWelcomed(store);
    expect(loadOnboarding(store)).toEqual({ welcomed: true, version: TOUR_VERSION });
    expect(shouldShowWelcome(loadOnboarding(store))).toBe(false);
  });
});
