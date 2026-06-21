import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the config driver.js is built with, and hand back a fake instance,
// so we can assert how the tour wires its end-of-run persistence without
// rendering a real overlay (driver's rAF transitions never complete in jsdom).
let capturedConfig: Record<string, unknown> | null = null;
const fakeInstance = {
  drive: vi.fn(),
  destroy: vi.fn(),
  isLastStep: vi.fn(() => false),
  getActiveIndex: vi.fn(() => 0),
  moveNext: vi.fn(),
  movePrevious: vi.fn(),
};
vi.mock("driver.js", () => ({
  driver: (config: Record<string, unknown>) => {
    capturedConfig = config;
    return fakeInstance;
  },
}));

import { createEngine, createTour, type TourDeps } from "./use-onboarding";
import { loadOnboarding } from "./onboarding-storage";

function makeDeps(over: Partial<TourDeps> = {}): TourDeps {
  return {
    navigate: vi.fn(),
    driverRef: { current: null },
    endedRef: { current: false },
    keyHandlerRef: { current: null },
    activeBefore: null,
    ...over,
  };
}

// jsdom's default (about:blank) origin has no usable localStorage, so back
// window.localStorage with an in-memory store for these tests.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

beforeEach(() => {
  capturedConfig = null;
  fakeInstance.isLastStep.mockReturnValue(false);
  Object.defineProperty(window, "localStorage", { value: memoryStorage(), configurable: true });
});

describe("onboarding persistence funnel", () => {
  it("finish persists completed exactly once (idempotent latch)", () => {
    const deps = makeDeps();
    const engine = createEngine(deps);
    engine.finish(true);
    engine.finish(false); // later end is ignored - already latched
    expect(loadOnboarding(window.localStorage)).toEqual({ completed: true, version: 1 });
    expect(deps.endedRef.current).toBe(true);
  });

  it("the ESC handler persists skipped", () => {
    const engine = createEngine(makeDeps());
    engine.onKeyDown(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(loadOnboarding(window.localStorage)).toEqual({ skipped: true, version: 1 });
  });

  it("a non-Escape key does not end the tour", () => {
    const engine = createEngine(makeDeps());
    engine.onKeyDown(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(loadOnboarding(window.localStorage)).toBeNull();
  });

  it("finishing the last step via Next persists completed", async () => {
    const deps = makeDeps({ driverRef: { current: fakeInstance as never } });
    fakeInstance.isLastStep.mockReturnValue(true);
    const engine = createEngine(deps);
    await engine.goNext();
    expect(loadOnboarding(window.localStorage)).toEqual({ completed: true, version: 1 });
  });

  it("native close (overlay / X button) persists skipped, with no onDestroyed dependency", () => {
    createTour(makeDeps());
    expect(capturedConfig).not.toBeNull();
    // Regression guard: persistence must not hinge on driver's onDestroyed, which
    // only fires once driver's rAF highlight transition has run.
    expect(capturedConfig!.onDestroyed).toBeUndefined();
    expect(typeof capturedConfig!.onDestroyStarted).toBe("function");
    (capturedConfig!.onDestroyStarted as () => void)();
    expect(loadOnboarding(window.localStorage)).toEqual({ skipped: true, version: 1 });
  });
});
