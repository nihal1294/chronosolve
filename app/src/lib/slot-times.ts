/** Wall-clock start/end for a slot, derived from the problem's optional
    slot_labels. Labels like "9:00 - 9:55" (the template's own example)
    parse directly; anything else falls back to synthetic periods running
    hourly from 08:00, so an unlabeled timetable still exports as a
    plausible calendar. */

export interface SlotTime {
  /** [hour, minute] in local time (timezone handling is out of scope). */
  start: [number, number];
  end: [number, number];
}

const LABEL_RANGE = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;

const DAY_START = 8 * 60;
const DAY_END = 24 * 60;
const LAST_MINUTE = 23 * 60 + 59;
const PERIOD = 60;
const LENGTH = 55;
const GAP = PERIOD - LENGTH;

const hourMinute = (minutes: number): [number, number] => [Math.floor(minutes / 60), minutes % 60];

/** Synthetic period for a slot with no usable label: hourly from 08:00,
    compressed to a shorter cadence once a day holds more slots than whole
    hours remain before midnight. Without that, every slot past the 16th
    would land on the same 23:00 range and export as overlapping,
    indistinguishable events. */
function syntheticTime(slot: number, slotCount: number): SlotTime {
  const period = Math.max(1, Math.min(PERIOD, Math.floor((DAY_END - DAY_START) / Math.max(slotCount, slot))));
  const start = Math.min(DAY_START + (slot - 1) * period, LAST_MINUTE - 1);
  const end = Math.min(start + Math.max(1, Math.min(LENGTH, period - GAP)), LAST_MINUTE);
  return { start: hourMinute(start), end: hourMinute(end) };
}

/** `slotCount` is how many slots the day holds; it only affects unlabeled
    slots, and defaults to treating this slot as the day's last. */
export function slotTimes(slot: number, labels: Record<number, string>, slotCount = slot): SlotTime {
  const match = labels[slot]?.trim().match(LABEL_RANGE);
  if (match) {
    const [startHour, startMinute, endHour, endMinute] = match.slice(1).map(Number);
    // Range-checked, and the end must follow the start: a typo like
    // "24:00 - 25:00", "09:99", or "10:00 - 09:00" would otherwise flow into
    // an invalid ICS DATE-TIME (or a DTEND at/before DTSTART).
    const valid = startHour <= 23 && endHour <= 23 && startMinute <= 59 && endMinute <= 59;
    if (valid && endHour * 60 + endMinute > startHour * 60 + startMinute) {
      return { start: [startHour, startMinute], end: [endHour, endMinute] };
    }
  }
  return syntheticTime(slot, slotCount);
}
