import { useEffect, useState } from "react";
import { solverClient, type ScheduleEntry } from "./solver-client";
import type { ProblemDoc } from "./problem-doc";

const DEBOUNCE_MS = 500;

/** A /score response tied to the exact schedule array it priced. */
export interface ScoredSchedule {
  schedule: ScheduleEntry[];
  score: number;
}

/** The edited-quality number to show: only a score priced for exactly the
    schedule on screen. Comparing by identity (each edit builds a new array)
    means stale responses, resets, and new solves all resolve to null here
    instead of through effect bookkeeping. */
export function visibleEditedScore(
  scored: ScoredSchedule | null,
  displaySchedule: ScheduleEntry[],
  edited: boolean,
): number | null {
  return edited && scored?.schedule === displaySchedule ? scored.score : null;
}

/** Re-price an edited schedule via /score, debounced per burst of drops.
    Returns null while unedited or in flight (see visibleEditedScore). */
export function useEditedQuality(
  doc: ProblemDoc | null,
  displaySchedule: ScheduleEntry[],
  edited: boolean,
): number | null {
  const [scored, setScored] = useState<ScoredSchedule | null>(null);

  useEffect(() => {
    if (!doc || !edited) return;
    const timer = setTimeout(() => {
      solverClient
        .score(doc, displaySchedule)
        .then((report) => setScored({ schedule: displaySchedule, score: report.overall_score }))
        // A failed re-price keeps the strip's pending state; the next drop retries.
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [doc, displaySchedule, edited]);

  return visibleEditedScore(scored, displaySchedule, edited);
}
