import { describe, expect, it } from "vitest";
import { buildConflictInputs } from "./conflict-model";
import { findConflicts } from "./conflicts";
import type { ScheduleEntry } from "./solver-client";

/** 2-day x 4-slot doc; individual tests override sections as needed. */
const doc = (patch: Record<string, unknown> = {}) => ({
  time_structure: { days: ["Mon", "Tue"], slots_per_day: 4 },
  teachers: [
    { id: "t1", name: "A" },
    { id: "t2", name: "B" },
  ],
  student_groups: [
    { id: "g1", name: "G1", size: 30 },
    { id: "g2", name: "G2", size: 25 },
  ],
  subjects: [
    { id: "math", name: "M", hours_per_week: 1, teacher_ids: ["t1"], group_ids: ["g1"] },
    { id: "eng", name: "E", hours_per_week: 1, teacher_ids: ["t2"], group_ids: ["g2"] },
  ],
  ...patch,
});

const entry = (
  subject: string,
  day: string,
  slot: number,
  people: { teachers?: string[]; groups?: string[]; room?: string | null } = {},
): ScheduleEntry => ({
  subject_id: subject,
  day,
  slot,
  teacher_ids: people.teachers ?? ["t1"],
  group_ids: people.groups ?? ["g1"],
  room_id: people.room ?? null,
});

const kinds = (docPatch: Record<string, unknown>, schedule: ScheduleEntry[]) =>
  findConflicts(buildConflictInputs(doc(docPatch)), schedule)
    .map((c) => c.kind)
    .sort();

describe("double-booking", () => {
  it("flags a teacher in two places at once and names both entries", () => {
    const schedule = [
      entry("math", "Mon", 1, { teachers: ["t1"], groups: ["g1"] }),
      entry("eng", "Mon", 1, { teachers: ["t1"], groups: ["g2"] }),
    ];
    const conflicts = findConflicts(buildConflictInputs(doc()), schedule);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].kind).toBe("teacher-double-book");
    expect(conflicts[0].entryKeys.sort()).toEqual(["eng|Mon|1", "math|Mon|1"]);
    expect(conflicts[0].message).toContain("t1");
  });

  it("flags group and room double-bookings independently", () => {
    const schedule = [
      entry("math", "Tue", 2, { teachers: ["t1"], groups: ["g1"], room: "r1" }),
      entry("eng", "Tue", 2, { teachers: ["t2"], groups: ["g1"], room: "r1" }),
    ];
    expect(kinds({ rooms: [{ id: "r1", name: "R", capacity: 99, type: "any" }] }, schedule)).toEqual([
      "group-double-book",
      "room-double-book",
    ]);
  });

  it("respects the no-clash flags when toggled off", () => {
    const schedule = [
      entry("math", "Mon", 1, { teachers: ["t1"] }),
      entry("eng", "Mon", 1, { teachers: ["t1"], groups: ["g2"] }),
    ];
    expect(kinds({ constraints: { hard: { teacher_no_clash: false } } }, schedule)).toEqual([]);
  });

  it("does not flag the same subject occupying two different slots", () => {
    const schedule = [entry("math", "Mon", 1), entry("math", "Mon", 2)];
    expect(kinds({}, schedule)).toEqual([]);
  });

  it("flags a subject stacked onto its own other occurrence (PR #34 review)", () => {
    // Moving one occurrence of math onto the other leaves two identical
    // entries; the backend's _clashes flags teacher AND group, so the
    // mirror must not collapse them into one schedule key.
    const schedule = [entry("math", "Mon", 1), entry("math", "Mon", 1)];
    expect(kinds({}, schedule)).toEqual(["group-double-book", "teacher-double-book"]);
  });

  it("does not flag duplicated owner ids within a single entry", () => {
    const schedule = [entry("math", "Mon", 1, { teachers: ["t1", "t1"] })];
    expect(kinds({}, schedule)).toEqual([]);
  });
});

describe("availability", () => {
  const unavailableDoc = {
    teachers: [
      { id: "t1", name: "A", unavailable: { Mon: [1, 2] } },
      { id: "t2", name: "B" },
    ],
    student_groups: [
      { id: "g1", name: "G1", size: 30, unavailable: { Tue: [4] } },
      { id: "g2", name: "G2", size: 25 },
    ],
  };

  it("flags entries inside a teacher's or group's unavailable slots", () => {
    expect(kinds(unavailableDoc, [entry("math", "Mon", 1)])).toEqual(["unavailable"]);
    expect(kinds(unavailableDoc, [entry("math", "Tue", 4, { teachers: ["t2"] })])).toEqual(["unavailable"]);
  });

  it("stays quiet outside the blocked slots and when the flag is off", () => {
    expect(kinds(unavailableDoc, [entry("math", "Mon", 3)])).toEqual([]);
    expect(
      kinds({ ...unavailableDoc, constraints: { hard: { respect_availability: false } } }, [
        entry("math", "Mon", 1),
      ]),
    ).toEqual([]);
  });
});

describe("room eligibility", () => {
  const roomsDoc = {
    subjects: [
      {
        id: "cs",
        name: "CS",
        hours_per_week: 1,
        teacher_ids: ["t1"],
        group_ids: ["g1", "g2"],
        preferred_room_type: "lab",
        required_tags: ["gpu"],
      },
    ],
    rooms: [
      { id: "small", name: "S", capacity: 40, type: "lecture", tags: [] },
      { id: "lab1", name: "L", capacity: 60, type: "lab", tags: ["gpu"] },
      { id: "multi", name: "M", capacity: 60, type: "any", tags: ["gpu"] },
    ],
  };
  const cs = (room: string) => [entry("cs", "Mon", 1, { groups: ["g1", "g2"], room })];

  it("flags wrong type and missing tags together for an ineligible room", () => {
    expect(kinds(roomsDoc, cs("small"))).toEqual(["room-tags", "room-type"]);
  });

  it("accepts the matching room and the multi-purpose 'any' room", () => {
    expect(kinds(roomsDoc, cs("lab1"))).toEqual([]);
    expect(kinds(roomsDoc, cs("multi"))).toEqual([]);
  });

  it("flags capacity only when the opt-in flag is set (need = sum of group sizes)", () => {
    const tight = {
      ...roomsDoc,
      rooms: [{ id: "lab1", name: "L", capacity: 50, type: "lab", tags: ["gpu"] }],
    };
    expect(kinds(tight, cs("lab1"))).toEqual([]); // g1 30 + g2 25 = 55 > 50, but flag defaults off
    expect(kinds({ ...tight, constraints: { hard: { room_capacity: true } } }, cs("lab1"))).toEqual([
      "room-capacity",
    ]);
  });
});
