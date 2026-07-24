/** Wall-clock start/end for a slot, derived from the problem's optional
    slot_labels. Labels like "9:00 - 9:55" (the template's own example)
    parse directly; anything else falls back to synthetic 55-minute
    periods on the hour from 08:00, so an unlabeled timetable still
    exports as a plausible calendar. */

export interface SlotTime {
  /** [hour, minute] in local time (timezone handling is out of scope). */
  start: [number, number];
  end: [number, number];
}

const LABEL_RANGE = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;

const FALLBACK_FIRST_HOUR = 8;
const FALLBACK_LAST_HOUR = 23;
const FALLBACK_MINUTES = 55;

export function slotTimes(slot: number, labels: Record<number, string>): SlotTime {
  const match = labels[slot]?.trim().match(LABEL_RANGE);
  if (match) {
    return {
      start: [Number(match[1]), Number(match[2])],
      end: [Number(match[3]), Number(match[4])],
    };
  }
  // Clamped: slot counts past midnight would otherwise emit an invalid
  // 24+ hour in the ICS DTSTART/DTEND.
  const hour = Math.min(FALLBACK_FIRST_HOUR + slot - 1, FALLBACK_LAST_HOUR);
  return { start: [hour, 0], end: [hour, FALLBACK_MINUTES] };
}
