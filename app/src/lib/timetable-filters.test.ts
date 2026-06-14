import { describe, expect, it } from "vitest";
import type { ProblemEntities } from "./entities";
import type { ScheduleEntry } from "./solver-client";
import {
  applyFilters,
  buildLookups,
  deriveFilterOptions,
  pivotByAxis,
  sessionMatches,
} from "./timetable-filters";

const entities = {
  subjects: [
    {
      id: "math",
      name: "Math",
      hoursPerWeek: 3,
      teacherIds: ["t1"],
      groupIds: ["g_cse3"],
      kind: "theory",
      consecutiveHours: 1,
    },
    {
      id: "lab",
      name: "Lab",
      hoursPerWeek: 2,
      teacherIds: ["t2"],
      groupIds: ["g_ece5"],
      kind: "lab",
      consecutiveHours: 2,
    },
  ],
  teachers: [],
  groups: [
    { id: "g_cse3", name: "CSE-3", size: 40, department: "CSE", semester: "3" },
    { id: "g_ece5", name: "ECE-5", size: 30, department: "ECE", semester: "5" },
  ],
  rooms: [],
  preAssignments: [],
  days: ["Mon"],
  slotsPerDay: 6,
  slotLabels: {},
} as unknown as ProblemEntities;

const entry = (
  subject_id: string,
  group_ids: string[],
  teacher_ids: string[],
  room_id: string | null,
): ScheduleEntry => ({
  subject_id,
  day: "Mon",
  slot: 1,
  teacher_ids,
  group_ids,
  room_id,
});

const schedule: ScheduleEntry[] = [
  entry("math", ["g_cse3"], ["t1"], "r1"),
  entry("lab", ["g_ece5"], ["t2"], "r2"),
];

describe("timetable-filters", () => {
  it("derives facet options from the data present, sorted and de-duplicated", () => {
    expect(deriveFilterOptions(entities)).toEqual({
      types: ["lab", "theory"],
      departments: ["CSE", "ECE"],
      semesters: ["3", "5"],
    });
  });

  it("matches a session only when it satisfies every active facet (combinable AND)", () => {
    const lookups = buildLookups(entities);
    const math = schedule[0];
    expect(sessionMatches(math, { type: "theory", department: "CSE", semester: "3" }, lookups)).toBe(true);
    // right department, wrong type -> excluded
    expect(sessionMatches(math, { type: "lab", department: "CSE", semester: "" }, lookups)).toBe(false);
    // empty facets match everything
    expect(sessionMatches(math, { type: "", department: "", semester: "" }, lookups)).toBe(true);
  });

  it("applyFilters narrows the schedule by department", () => {
    const lookups = buildLookups(entities);
    const ece = applyFilters(schedule, { type: "", department: "ECE", semester: "" }, lookups);
    expect(ece.map((e) => e.subject_id)).toEqual(["lab"]);
  });

  it("pivots by each axis, placing a session under every owner", () => {
    expect([...pivotByAxis(schedule, "class").keys()].sort()).toEqual(["g_cse3", "g_ece5"]);
    expect([...pivotByAxis(schedule, "teacher").keys()].sort()).toEqual(["t1", "t2"]);
    expect([...pivotByAxis(schedule, "room").keys()].sort()).toEqual(["r1", "r2"]);
  });

  it("buckets roomless sessions under a placeholder key", () => {
    const roomless = pivotByAxis([entry("math", ["g_cse3"], ["t1"], null)], "room");
    expect([...roomless.keys()]).toEqual(["(no room)"]);
  });
});
