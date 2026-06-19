import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES, loadPreferences, MAX_TIME_LIMIT, savePreferences } from "./use-preferences";

// This jsdom build does not implement localStorage, so back it with an
// in-memory map for the round-trip (the real app uses the browser's).
function createStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("preferences persistence", () => {
  beforeEach(() => vi.stubGlobal("localStorage", createStorageMock()));

  it("returns defaults when nothing is stored", () => {
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("round-trips saved values", () => {
    savePreferences({ timeLimit: 15, notifyOnComplete: false });
    expect(loadPreferences()).toEqual({ timeLimit: 15, notifyOnComplete: false });
  });

  it("falls back to defaults on a corrupt blob", () => {
    localStorage.setItem("chronosolve-prefs", "{not json");
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("repairs invalid fields without discarding valid ones", () => {
    // timeLimit must be a positive number; notifyOnComplete is valid and kept.
    localStorage.setItem("chronosolve-prefs", JSON.stringify({ timeLimit: -5, notifyOnComplete: false }));
    expect(loadPreferences()).toEqual({
      timeLimit: DEFAULT_PREFERENCES.timeLimit,
      notifyOnComplete: false,
    });
  });

  it("caps a stored time limit above the supported maximum", () => {
    // A positive-but-out-of-range blob (older build, manual edit) must not reach
    // the solver above the advertised cap - load clamps it, not just the input.
    localStorage.setItem("chronosolve-prefs", JSON.stringify({ timeLimit: 9999, notifyOnComplete: true }));
    expect(loadPreferences().timeLimit).toBe(MAX_TIME_LIMIT);
  });
});
