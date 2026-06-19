import { useState } from "react";

/** User-tunable app preferences persisted across launches. Theme is owned by
    next-themes (its own storage), so it is not duplicated here. */
export interface Preferences {
  /** Solver max execution time in seconds (passed to the solve as time_limit). */
  timeLimit: number;
  /** Toast when a solve finishes. */
  notifyOnComplete: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { timeLimit: 60, notifyOnComplete: true };

/** Supported solver time-limit bounds (seconds). Enforced on BOTH the Settings
    input and the loaded value so an out-of-range blob (older build, manual edit,
    partial corruption) never reaches the solver. */
export const MIN_TIME_LIMIT = 1;
export const MAX_TIME_LIMIT = 600;

/** Clamp a time limit to the supported [MIN, MAX] range. */
export function clampTimeLimit(seconds: number): number {
  return Math.min(MAX_TIME_LIMIT, Math.max(MIN_TIME_LIMIT, seconds));
}

const KEY = "chronosolve-prefs";

/** Read persisted preferences, falling back to a default per field for missing
    or invalid values - a corrupt or partial blob never breaks the app. */
export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      timeLimit:
        typeof parsed.timeLimit === "number" && parsed.timeLimit > 0
          ? clampTimeLimit(parsed.timeLimit)
          : DEFAULT_PREFERENCES.timeLimit,
      notifyOnComplete:
        typeof parsed.notifyOnComplete === "boolean"
          ? parsed.notifyOnComplete
          : DEFAULT_PREFERENCES.notifyOnComplete,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: Preferences): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

/** Settings-form state seeded from storage; every change persists immediately
    so the next solve reads the new value via loadPreferences(). */
export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences);
  const setPref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      savePreferences(next);
      return next;
    });
  };
  return { prefs, setPref };
}
