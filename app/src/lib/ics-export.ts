import { slotTimes } from "./slot-times";
import type { ScheduleEntry } from "./solver-client";

/** iCalendar (RFC 5545) builder for a schedule slice. Sessions carry no
    dates, so each becomes a weekly recurring event (COUNT below) anchored
    to the NEXT occurrence of its weekday relative to `from`. Times are
    floating local times (no TZID) - fine for a single-campus timetable. */

export interface IcsOptions {
  /** "Today" for the next-weekday anchor (injected so tests are deterministic). */
  from: Date;
  labels: Record<number, string>;
  /** Slots the day holds; only shapes the synthetic times of unlabeled slots. */
  slotCount: number;
  subjectName: (id: string) => string;
  roomName: (id: string) => string;
}

const WEEKS = 12;

/** Mon..Sun by 3-letter prefix, matching both "Mon" and "Monday" (Date.getDay order). */
const WEEKDAYS: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/** RFC 5545 3.3.11: TEXT escapes backslash, semicolon and comma, and carries
    line breaks only as the literal \n sequence. Every break form collapses to
    one of those - a raw CR left in a name would otherwise sit inside a content
    line and break the CRLF framing. */
const escapeText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");

/** RFC 5545 3.1: a content line is at most 75 octets, longer values continue
    on the next line behind a single space. Subject and room names have no
    length limit, so a plain SUMMARY can exceed that on its own. Splitting
    counts UTF-8 octets and never divides a character. */
const OCTET_LIMIT = 75;

const foldLine = (line: string): string => {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= OCTET_LIMIT) return line;
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    // Continuation lines spend one octet on their leading space.
    const limit = parts.length === 0 ? OCTET_LIMIT : OCTET_LIMIT - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
    }
    current += character;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
};

const two = (n: number): string => String(n).padStart(2, "0");

const stamp = (date: Date, [hour, minute]: [number, number]): string =>
  `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}T${two(hour)}${two(minute)}00`;

/** DTSTAMP is a required VEVENT property (RFC 5545 3.6.1) and must be UTC. */
const utcStamp = (date: Date): string =>
  `${date.getUTCFullYear()}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}T` +
  `${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}Z`;

/** The next date on or after `from` falling on the given weekday. */
const nextWeekday = (from: Date, weekday: number): Date => {
  const date = new Date(from);
  date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7));
  return date;
};

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const eventLines = (entry: ScheduleEntry, anchor: Date, opts: IcsOptions, slotCount: number): string[] => {
  const { start, end } = slotTimes(entry.slot, opts.labels, slotCount);
  // A same-day session whose start already passed anchors to next week, so
  // COUNT covers upcoming occurrences instead of one past plus the rest.
  const date = new Date(anchor);
  if (
    sameDay(anchor, opts.from) &&
    start[0] * 60 + start[1] < opts.from.getHours() * 60 + opts.from.getMinutes()
  ) {
    date.setDate(date.getDate() + 7);
  }
  // Deliberately scope-independent: (subject, day, slot) identifies the lesson
  // itself, so a teacher's and a class's calendars carry ONE UID for a session
  // they share and a calendar holding both shows one meeting, not a duplicate
  // per attendee. It is unique within a problem because the solver forbids
  // double-booking a teacher or group at a slot. It is NOT unique across
  // separate problem files that reuse subject ids at the same day and slot;
  // distinguishing those would need a stable problem identity, which the
  // document has no notion of today.
  const uid = `${entry.subject_id}-${entry.day.slice(0, 3).toLowerCase()}-${entry.slot}@chronosolve`;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeText(uid)}`,
    `DTSTAMP:${utcStamp(opts.from)}`,
    `DTSTART:${stamp(date, start)}`,
    `DTEND:${stamp(date, end)}`,
    `RRULE:FREQ=WEEKLY;COUNT=${WEEKS}`,
    `SUMMARY:${escapeText(opts.subjectName(entry.subject_id))}`,
  ];
  if (entry.room_id !== null) lines.push(`LOCATION:${escapeText(opts.roomName(entry.room_id))}`);
  lines.push("END:VEVENT");
  return lines;
};

/** The schedule slice one calendar covers: a single teacher's or group's sessions. */
export function icsSessionsFor(
  schedule: ScheduleEntry[],
  kind: "teacher" | "group",
  id: string,
): ScheduleEntry[] {
  return schedule.filter((entry) => (kind === "teacher" ? entry.teacher_ids : entry.group_ids).includes(id));
}

export function buildIcs(sessions: ScheduleEntry[], opts: IcsOptions): { ics: string; skipped: string[] } {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ChronoSolve//Timetable//EN"];
  const skipped: string[] = [];
  // One cadence for the whole file: per-day slot_overrides can push sessions
  // past the configured slots_per_day, and mixing cadences within a calendar
  // would give the same slot different times.
  const slotCount = Math.max(opts.slotCount, ...sessions.map((entry) => entry.slot), 1);
  for (const entry of sessions) {
    const weekday = WEEKDAYS[entry.day.slice(0, 3).toLowerCase()];
    if (weekday === undefined) {
      if (!skipped.includes(entry.day)) skipped.push(entry.day);
      continue;
    }
    lines.push(...eventLines(entry, nextWeekday(opts.from, weekday), opts, slotCount));
  }
  lines.push("END:VCALENDAR");
  return { ics: `${lines.map(foldLine).join("\r\n")}\r\n`, skipped };
}
