import { describe, expect, it } from "vitest";
import fixtures from "./conflict-contract.fixtures.json";
import { buildConflictInputs } from "./conflict-model";
import { findConflicts } from "./conflicts";
import type { ScheduleEntry } from "./solver-client";

/** One half of the two-sided contract; tests/test_conflict_contract.py runs
    the SAME cases through the backend's find_hard_violations. */
describe("conflict-checker contract (frontend half)", () => {
  for (const c of fixtures.cases) {
    it(c.name, () => {
      const conflicts = findConflicts(buildConflictInputs(c.problem), c.schedule as ScheduleEntry[]);
      const got = [...new Set(conflicts.map((x) => x.kind))].sort();
      const want = [...new Set(c.expect.map((e) => e.kind))].sort();
      expect(got).toEqual(want);
    });
  }
});
