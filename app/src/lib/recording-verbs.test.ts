import { describe, expect, it } from "vitest";
import { recordingEdits } from "./recording-verbs";
import type { EditAction } from "./edit-history";
import type { ManualOverride } from "./overrides";
import type { ManualEdits } from "./use-manual-edits";
import type { ScheduleEntry } from "./solver-client";

const ENTRY: ScheduleEntry = {
  subject_id: "math",
  day: "Mon",
  slot: 1,
  teacher_ids: ["t1"],
  group_ids: ["g1"],
  room_id: null,
};

const MOVE: ManualOverride = {
  kind: "move",
  subjectId: "math",
  from: { day: "Mon", slot: 1 },
  to: { day: "Tue", slot: 2 },
};

const ROOM: ManualOverride = {
  kind: "room",
  subjectId: "math",
  at: { day: "Mon", slot: 1 },
  roomId: "r9",
};

const UNPLACE: ManualOverride = {
  kind: "unplace",
  subjectId: "math",
  at: { day: "Mon", slot: 1 },
};

/** What each wrapped verb should report. Omitted = the verb changed nothing. */
interface Returns {
  move?: ManualOverride;
  room?: ManualOverride;
  unplace?: ManualOverride;
  putback?: ManualOverride;
}

/** A ManualEdits whose verbs hand back exactly what the test queued. Fully
    typed (no cast) so a new interface member breaks this test rather than
    silently going unwrapped. */
const stubEdits = (returns: Returns): ManualEdits => ({
  overrides: [],
  displaySchedule: [],
  conflicts: [],
  conflictKeys: new Set<string>(),
  unplaced: [],
  moveSession: () => returns.move ?? null,
  roomSession: () => returns.room ?? null,
  unplaceSession: () => returns.unplace ?? null,
  removeUnplaceAt: () => returns.putback ?? null,
  insertOverride: () => {},
  popOverride: () => {},
  pushOverride: () => {},
  resetEdits: () => {},
});

const collect = () => {
  const actions: EditAction[] = [];
  return { actions, record: (action: EditAction) => actions.push(action) };
};

describe("recordingEdits", () => {
  it("records a move and hands the override back to the caller", () => {
    const { actions, record } = collect();
    const wrapped = recordingEdits(stubEdits({ move: MOVE }), record);
    expect(wrapped.moveSession(ENTRY, { day: "Tue", slot: 2 })).toBe(MOVE);
    expect(actions).toEqual([{ kind: "move", override: MOVE }]);
  });

  it("records a room change under its own kind", () => {
    const { actions, record } = collect();
    const wrapped = recordingEdits(stubEdits({ room: ROOM }), record);
    expect(wrapped.roomSession(ENTRY, "r9")).toBe(ROOM);
    expect(actions).toEqual([{ kind: "room", override: ROOM }]);
  });

  it("records an unplace under its own kind", () => {
    const { actions, record } = collect();
    const wrapped = recordingEdits(stubEdits({ unplace: UNPLACE }), record);
    expect(wrapped.unplaceSession(ENTRY, new Set<string>())).toBe(UNPLACE);
    expect(actions).toEqual([{ kind: "unplace", override: UNPLACE }]);
  });

  it("records a Put back WITH the index it removed from", () => {
    const { actions, record } = collect();
    const wrapped = recordingEdits(stubEdits({ putback: UNPLACE }), record);
    expect(wrapped.removeUnplaceAt(2)).toBe(UNPLACE);
    expect(actions).toEqual([{ kind: "putback", removed: UNPLACE, index: 2 }]);
  });

  it("records NOTHING when a verb reports no change", () => {
    // The invariant: history pushes iff the override log changed. A no-op drop,
    // a re-picked room, a refused (pinned) unplace, and a Put back at an index
    // holding no unplace all return null - recording them would misalign the
    // history tail with the log, and undo would pop a REAL override.
    const { actions, record } = collect();
    const wrapped = recordingEdits(stubEdits({}), record);
    wrapped.moveSession(ENTRY, { day: "Tue", slot: 2 });
    wrapped.roomSession(ENTRY, "r9");
    wrapped.unplaceSession(ENTRY, new Set<string>());
    wrapped.removeUnplaceAt(0);
    expect(actions).toEqual([]);
  });

  it("passes the undo/redo primitives through untouched (they must not record)", () => {
    const edits = stubEdits({});
    const wrapped = recordingEdits(edits, () => {});
    expect(wrapped.popOverride).toBe(edits.popOverride);
    expect(wrapped.pushOverride).toBe(edits.pushOverride);
    expect(wrapped.insertOverride).toBe(edits.insertOverride);
    expect(wrapped.resetEdits).toBe(edits.resetEdits);
  });
});
