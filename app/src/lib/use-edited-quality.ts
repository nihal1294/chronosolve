import { useEffect, useState } from "react";
import { solverClient, type ScheduleEntry } from "./solver-client";
import type { ProblemDoc } from "./problem-doc";

const DEBOUNCE_MS = 500;

/** Re-price an edited schedule via /score, debounced per burst of drops.
    The response is stored WITH the schedule identity it priced, and only a
    score matching the currently shown schedule is returned - so stale
    responses, resets, and new solves all fall out of one derivation instead
    of effect bookkeeping. Returns null while unedited or in flight. */
export function useEditedQuality(
  doc: ProblemDoc | null,
  displaySchedule: ScheduleEntry[],
  edited: boolean,
): number | null {
  const [scored, setScored] = useState<{ schedule: ScheduleEntry[]; score: number } | null>(null);

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

  return edited && scored?.schedule === displaySchedule ? scored.score : null;
}
