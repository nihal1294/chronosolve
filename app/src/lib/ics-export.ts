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
  subjectName: (id: string) => string;
  roomName: (id: string | null) => string;
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

const escapeText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const two = (n: number): string => String(n).padStart(2, "0");

const stamp = (date: Date, [hour, minute]: [number, number]): string =>
  `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}T${two(hour)}${two(minute)}00`;

/** The next date on or after `from` falling on the given weekday. */
const nextWeekday = (from: Date, weekday: number): Date => {
  const date = new Date(from);
  date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7));
  return date;
};

const eventLines = (entry: ScheduleEntry, date: Date, opts: IcsOptions): string[] => {
  const { start, end } = slotTimes(entry.slot, opts.labels);
  const uid = `${entry.subject_id}-${entry.day.slice(0, 3).toLowerCase()}-${entry.slot}@chronosolve`;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeText(uid)}`,
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
  for (const entry of sessions) {
    const weekday = WEEKDAYS[entry.day.slice(0, 3).toLowerCase()];
    if (weekday === undefined) {
      if (!skipped.includes(entry.day)) skipped.push(entry.day);
      continue;
    }
    lines.push(...eventLines(entry, nextWeekday(opts.from, weekday), opts));
  }
  lines.push("END:VCALENDAR");
  return { ics: `${lines.join("\r\n")}\r\n`, skipped };
}
