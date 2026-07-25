import { describe, expect, it } from "vitest";
import { buildIcs, icsSessionsFor, type IcsOptions } from "./ics-export";
import type { ScheduleEntry } from "./solver-client";

const entry = (subject: string, day: string, slot: number, room: string | null = null): ScheduleEntry => ({
  subject_id: subject,
  day,
  slot,
  teacher_ids: ["t1"],
  group_ids: ["g1"],
  room_id: room,
});

// 2026-07-19 is a Sunday; the next Monday is 2026-07-20.
const SUNDAY = new Date(2026, 6, 19);

const opts = (overrides: Partial<IcsOptions> = {}): IcsOptions => ({
  from: SUNDAY,
  labels: { 1: "9:00 - 9:55" },
  slotCount: 8,
  subjectName: (id) => (id === "math" ? "Mathematics" : id),
  roomName: (id) => (id === "r1" ? "Room 101" : (id ?? "")),
  ...overrides,
});

describe("icsSessionsFor", () => {
  const schedule = [
    entry("math", "Mon", 1),
    { ...entry("eng", "Tue", 2), teacher_ids: ["t2"], group_ids: ["g2"] },
  ];

  it("keeps only the sessions taught by the chosen teacher", () => {
    expect(icsSessionsFor(schedule, "teacher", "t2")).toEqual([schedule[1]]);
  });

  it("keeps only the sessions attended by the chosen group", () => {
    expect(icsSessionsFor(schedule, "group", "g1")).toEqual([schedule[0]]);
  });
});

describe("buildIcs", () => {
  it("produces a VCALENDAR skeleton with CRLF line endings", () => {
    const { ics } = buildIcs([entry("math", "Mon", 1)], opts());
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("anchors DTSTART to the next occurrence of the weekday at the label time", () => {
    const { ics } = buildIcs([entry("math", "Mon", 1)], opts());
    expect(ics).toContain("DTSTART:20260720T090000\r\n");
    expect(ics).toContain("DTEND:20260720T095500\r\n");
  });

  it("anchors a same-day session to next week when its start has already passed", () => {
    const mondayAfternoon = new Date(2026, 6, 20, 15, 0);
    const { ics } = buildIcs([entry("math", "Mon", 1)], opts({ from: mondayAfternoon }));
    expect(ics).toContain("DTSTART:20260727T090000\r\n");
  });

  it("keeps a same-day session that has not started yet", () => {
    const mondayMorning = new Date(2026, 6, 20, 8, 30);
    const { ics } = buildIcs([entry("math", "Mon", 1)], opts({ from: mondayMorning }));
    expect(ics).toContain("DTSTART:20260720T090000\r\n");
  });

  it("accepts full weekday names and repeats weekly for 12 weeks", () => {
    const { ics } = buildIcs([entry("math", "Wednesday", 1)], opts());
    expect(ics).toContain("DTSTART:20260722T090000\r\n");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;COUNT=12\r\n");
  });

  it("puts the subject in SUMMARY and the room in LOCATION", () => {
    const { ics } = buildIcs([entry("math", "Mon", 1, "r1")], opts());
    expect(ics).toContain("SUMMARY:Mathematics\r\n");
    expect(ics).toContain("LOCATION:Room 101\r\n");
  });

  it("escapes commas, semicolons, and backslashes in text (RFC 5545)", () => {
    const { ics } = buildIcs(
      [entry("lab", "Mon", 1)],
      opts({ subjectName: () => "Lab; advanced, part\\one" }),
    );
    expect(ics).toContain("SUMMARY:Lab\\; advanced\\, part\\\\one\r\n");
  });

  it("gives every event a stable UID per occurrence", () => {
    const { ics } = buildIcs([entry("math", "Mon", 1), entry("math", "Tue", 2)], opts());
    expect(ics).toContain("UID:math-mon-1@chronosolve\r\n");
    expect(ics).toContain("UID:math-tue-2@chronosolve\r\n");
  });

  it("stamps every event with a UTC DTSTAMP derived from the injected 'from'", () => {
    const { ics } = buildIcs([entry("math", "Mon", 1), entry("eng", "Tue", 2)], opts());
    const expected = `DTSTAMP:${SUNDAY.toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}\r\n`;
    expect(ics.match(/DTSTAMP:/g)).toHaveLength(2);
    expect(ics).toContain(expected);
  });

  it("gives unlabeled sessions of a long day distinct start times", () => {
    const sessions = [16, 17, 18, 19, 20].map((slot) => entry("math", "Mon", slot));
    const { ics } = buildIcs(sessions, opts({ labels: {}, slotCount: 20 }));
    const starts = [...ics.matchAll(/DTSTART:(\d{8}T\d{6})/g)].map((match) => match[1]);
    expect(starts).toHaveLength(5);
    expect(new Set(starts).size).toBe(5);
  });

  it("skips entries whose day is not a recognizable weekday and reports them", () => {
    const { ics, skipped } = buildIcs([entry("math", "Funday", 1), entry("math", "Mon", 1)], opts());
    expect(skipped).toEqual(["Funday"]);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
