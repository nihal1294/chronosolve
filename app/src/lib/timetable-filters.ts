/** Pure filter + pivot logic behind the Timetable route. Kept UI-free so the
    combinable-facet contract (a session passes only if it matches every active
    facet) and the per-axis pivots are unit-testable. */

import type { ScheduleEntry } from "./solver-client";
import type { ProblemEntities } from "./entities";

/** Per-entity grid axes (one clean weekly grid per entity). "master" is not an
    axis - it renders the whole filtered schedule in a single stacked grid. */
export type Axis = "class" | "teacher" | "room";
export type Perspective = Axis | "master";

/** "" means "all" for every facet. */
export interface TimetableFilters {
  type: string;
  department: string;
  semester: string;
}

export const EMPTY_FILTERS: TimetableFilters = { type: "", department: "", semester: "" };

export interface FilterOptions {
  types: string[];
  departments: string[];
  semesters: string[];
}

export interface Lookups {
  subjectType: Map<string, string>;
  groupDepartment: Map<string, string>;
  groupSemester: Map<string, string>;
}

/** Index the lookups a session needs to be classified by facet. */
export function buildLookups(entities: ProblemEntities): Lookups {
  return {
    subjectType: new Map(entities.subjects.map((s) => [s.id, s.kind])),
    groupDepartment: new Map(entities.groups.map((g) => [g.id, g.department])),
    groupSemester: new Map(entities.groups.map((g) => [g.id, g.semester])),
  };
}

const distinct = (values: string[]): string[] =>
  [...new Set(values.filter((v) => v !== ""))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );

/** Facet dropdown options, derived from the data actually present. */
export function deriveFilterOptions(entities: ProblemEntities): FilterOptions {
  return {
    types: distinct(entities.subjects.map((s) => s.kind)),
    departments: distinct(entities.groups.map((g) => g.department)),
    semesters: distinct(entities.groups.map((g) => g.semester)),
  };
}

/** A session passes only if it matches EVERY active facet (combinable AND).
    Department/semester are group properties, so a session matches when ANY of
    its groups matches (a shared lecture can belong to several sections). */
export function sessionMatches(entry: ScheduleEntry, filters: TimetableFilters, lookups: Lookups): boolean {
  if (filters.type !== "" && lookups.subjectType.get(entry.subject_id) !== filters.type) return false;
  if (
    filters.department !== "" &&
    !entry.group_ids.some((g) => lookups.groupDepartment.get(g) === filters.department)
  )
    return false;
  if (
    filters.semester !== "" &&
    !entry.group_ids.some((g) => lookups.groupSemester.get(g) === filters.semester)
  )
    return false;
  return true;
}

export function applyFilters(
  schedule: ScheduleEntry[],
  filters: TimetableFilters,
  lookups: Lookups,
): ScheduleEntry[] {
  return schedule.filter((entry) => sessionMatches(entry, filters, lookups));
}

/** Group sessions by the chosen axis entity. A session with several groups (or
    teachers) appears under each - the same lecture shows on every owner's grid. */
export function pivotByAxis(schedule: ScheduleEntry[], axis: Axis): Map<string, ScheduleEntry[]> {
  const map = new Map<string, ScheduleEntry[]>();
  const add = (key: string, entry: ScheduleEntry) => {
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  };
  for (const entry of schedule) {
    if (axis === "teacher") entry.teacher_ids.forEach((id) => add(id, entry));
    else if (axis === "room") add(entry.room_id ?? "(no room)", entry);
    else entry.group_ids.forEach((id) => add(id, entry));
  }
  return map;
}
