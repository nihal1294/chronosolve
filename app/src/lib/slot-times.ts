/** Wall-clock start/end for a slot, derived from the problem's optional
    slot_labels. Labels like "9:00 - 9:55" (the template's own example)
    parse directly; slots without a usable label take a synthetic period,
    running on from the previous slot so a partly labeled timetable still
    exports as a plausible, non-overlapping calendar. */

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

const totalMinutes = ([hour, minute]: [number, number]): number => hour * 60 + minute;

/** A label only counts when it is a real time of day that ends after it
    starts: "24:00 - 25:00", "09:99", and "10:00 - 09:00" would otherwise flow
    into an invalid ICS DATE-TIME (or a DTEND at/before DTSTART). */
const parseLabel = (label: string | undefined): SlotTime | null => {
  const match = label?.trim().match(LABEL_RANGE);
  if (!match) return null;
  const [startHour, startMinute, endHour, endMinute] = match.slice(1).map(Number);
  if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return null;
  const start: [number, number] = [startHour, startMinute];
  const end: [number, number] = [endHour, endMinute];
  return totalMinutes(end) > totalMinutes(start) ? { start, end } : null;
};

/** Synthetic slots run hourly, compressed to share out whatever is left of the
    day when that many whole hours do not remain before midnight. */
const cadence = (from: number, slotsLeft: number): { period: number; length: number } => {
  const period = Math.max(1, Math.min(PERIOD, Math.floor((DAY_END - from) / slotsLeft)));
  return { period, length: Math.max(1, Math.min(LENGTH, period - GAP)) };
};

/** `slotCount` is how many slots the day holds; it only shapes unlabeled
    slots, and defaults to treating this slot as the day's last. */
export function slotTimes(slot: number, labels: Record<number, string>, slotCount = slot): SlotTime {
  const total = Math.max(slotCount, slot, 1);
  // Walk the day so an unlabeled slot begins after whatever precedes it,
  // labeled or not, instead of restarting at 08:00 and overlapping it.
  let cursor = DAY_START;
  for (let index = 1; index <= slot; index++) {
    const labeled = parseLabel(labels[index]);
    if (labeled) {
      if (index === slot) return labeled;
      cursor = totalMinutes(labeled.end) + GAP;
      continue;
    }
    // Derived here rather than once up front: a label can leave the slots after
    // it less of the day than an even split of the whole day would give them,
    // which used to run the last few together at the end-of-day clamp. Labels
    // that consume the day outright leave nothing to share out - the clamp is
    // all that is left then, since a slot may not spill past midnight.
    const { period, length } = cadence(cursor, Math.max(total - index + 1, 1));
    const start = Math.min(cursor, LAST_MINUTE - 1);
    if (index === slot) {
      return { start: hourMinute(start), end: hourMinute(Math.min(start + length, LAST_MINUTE)) };
    }
    cursor = start + period;
  }
  return { start: hourMinute(DAY_START), end: hourMinute(DAY_START + LENGTH) };
}
