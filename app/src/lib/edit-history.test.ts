import { describe, expect, it } from "vitest";
import {
  activeHistory,
  canRedo,
  canUndo,
  docPinAt,
  EMPTY_HISTORY,
  invertAction,
  pushAction,
  redoStep,
  replayAction,
  undoStep,
  type EditAction,
  type HistoryExec,
} from "./edit-history";
import type { ManualOverride } from "./overrides";
import type { ProblemDoc } from "./problem-doc";
import type { ScheduleEntry } from "./solver-client";

const moveOverride: ManualOverride = {
  kind: "move",
  subjectId: "math",
  from: { day: "Mon", slot: 1 },
  to: { day: "Tue", slot: 2 },
};
const roomOverride: ManualOverride = {
  kind: "room",
  subjectId: "math",
  at: { day: "Tue", slot: 2 },
  roomId: "r9",
};

const MOVE: EditAction = { kind: "move", override: moveOverride };
const LOCK: EditAction = { kind: "lock", pin: { subjectId: "eng", day: "Wed", slot: 3 }, wasLocked: false };
const ROOM: EditAction = { kind: "room", override: roomOverride };

describe("edit history (pure LIFO, M8c)", () => {
  it("undoes interleaved actions in reverse push order", () => {
    let history = [MOVE, LOCK, ROOM].reduce(pushAction, EMPTY_HISTORY);
    const popped: EditAction[] = [];
    for (let i = 0; i < 3; i++) {
      const step = undoStep(history);
      if (!step) throw new Error("expected an undo step");
      popped.push(step.action);
      history = step.history;
    }
    expect(popped).toEqual([ROOM, LOCK, MOVE]);
    expect(canUndo(history)).toBe(false);
    expect(undoStep(history)).toBeNull();
  });

  it("round-trips: redo returns the action with its payload intact", () => {
    const pushed = pushAction(EMPTY_HISTORY, ROOM);
    const undone = undoStep(pushed);
    if (!undone) throw new Error("expected an undo step");
    expect(canRedo(undone.history)).toBe(true);
    const redone = redoStep(undone.history);
    if (!redone) throw new Error("expected a redo step");
    expect(redone.action).toBe(ROOM); // identity: the override payload survives the trip
    expect(redone.history).toEqual(pushed);
    expect(redoStep(pushed)).toBeNull();
  });

  it("a fresh action clears the undone future", () => {
    const undone = undoStep(pushAction(EMPTY_HISTORY, MOVE));
    if (!undone) throw new Error("expected an undo step");
    const next = pushAction(undone.history, LOCK);
    expect(canRedo(next)).toBe(false);
    expect(next.done).toEqual([LOCK]);
  });

  it("activeHistory scopes to the base schedule (new solve derives empty)", () => {
    const schedule: ScheduleEntry[] = [];
    const state = { base: schedule, history: pushAction(EMPTY_HISTORY, MOVE) };
    expect(activeHistory(state, schedule)).toBe(state.history);
    expect(activeHistory(state, [])).toBe(EMPTY_HISTORY); // a NEW array is a new solve
    expect(activeHistory(null, schedule)).toBe(EMPTY_HISTORY);
  });
});

const entryAt = (subject: string, day: string, slot: number): ScheduleEntry => ({
  subject_id: subject,
  day,
  slot,
  teacher_ids: [],
  group_ids: [],
  room_id: null,
});

describe("docPinAt", () => {
  const doc = {
    pre_assignments: [
      { subject_id: "eng", day: "Wed", slot: 3, room_id: "lab1" },
      { subject_id: "sci", day: "Thu", slot: 1 },
    ],
  };
  it("returns the pin with the room it carries, bare pins bare, misses null", () => {
    expect(docPinAt(doc, entryAt("eng", "Wed", 3))).toEqual({
      subjectId: "eng",
      day: "Wed",
      slot: 3,
      roomId: "lab1",
    });
    expect(docPinAt(doc, entryAt("sci", "Thu", 1))).toEqual({ subjectId: "sci", day: "Thu", slot: 1 });
    expect(docPinAt(doc, entryAt("eng", "Wed", 4))).toBeNull();
    expect(docPinAt(null, entryAt("eng", "Wed", 3))).toBeNull();
  });
});

const harness = (doc: ProblemDoc | null) => {
  const log: string[] = [];
  let written: ProblemDoc | null = null;
  const exec: HistoryExec = {
    doc,
    popOverride: () => log.push("pop"),
    pushOverride: (override) => log.push(`push:${override.kind}`),
    applyDocEdit: (next) => {
      written = next;
    },
    reapply: () => log.push("reapply"),
  };
  return { exec, log, pins: () => (written === null ? null : written.pre_assignments) };
};

describe("invertAction / replayAction (doc-level executors)", () => {
  it("session kinds only touch the override log: undo pops, redo re-appends", () => {
    const h = harness({});
    invertAction(MOVE, h.exec);
    replayAction(ROOM, h.exec);
    expect(h.log).toEqual(["pop", "push:room"]);
    expect(h.pins()).toBeNull(); // no doc write
  });

  it("undo of a pin removes it; redo re-pins it", () => {
    const doc = { pre_assignments: [{ subject_id: "eng", day: "Wed", slot: 3 }] };
    const undoH = harness(doc);
    invertAction(LOCK, undoH.exec); // LOCK pinned eng@Wed/3 (wasLocked: false)
    expect(undoH.pins()).toEqual([]);
    const redoH = harness({});
    replayAction(LOCK, redoH.exec);
    expect(redoH.pins()).toEqual([{ subject_id: "eng", day: "Wed", slot: 3 }]);
  });

  it("undo of an unpin restores the pin WITH the room it carried", () => {
    const action: EditAction = {
      kind: "lock",
      pin: { subjectId: "eng", day: "Wed", slot: 3, roomId: "lab1" },
      wasLocked: true,
    };
    const h = harness({});
    invertAction(action, h.exec);
    expect(h.pins()).toEqual([{ subject_id: "eng", day: "Wed", slot: 3, room_id: "lab1" }]);
    const redoH = harness({ pre_assignments: [{ subject_id: "eng", day: "Wed", slot: 3, room_id: "lab1" }] });
    replayAction(action, redoH.exec); // redo the unpin
    expect(redoH.pins()).toEqual([]);
  });

  it("undo of an apply unpins added and restores replaced priors (roomless stays roomless)", () => {
    const doc = {
      pre_assignments: [
        { subject_id: "math", day: "Mon", slot: 1, room_id: "r9" },
        { subject_id: "eng", day: "Tue", slot: 2, room_id: "r2" },
        { subject_id: "sci", day: "Thu", slot: 1 },
      ],
    };
    const action: EditAction = {
      kind: "apply",
      added: [{ subjectId: "math", day: "Mon", slot: 1, roomId: "r9" }],
      replaced: [{ subjectId: "eng", day: "Tue", slot: 2 }], // prior was roomless
      removed: [],
    };
    const h = harness(doc);
    invertAction(action, h.exec);
    expect(h.pins()).toEqual([
      { subject_id: "sci", day: "Thu", slot: 1 },
      { subject_id: "eng", day: "Tue", slot: 2 }, // room stripped back off
    ]);
  });

  it("undo of an apply re-pins the doc pins a move had removed (room kept)", () => {
    const doc = { pre_assignments: [{ subject_id: "math", day: "Tue", slot: 2, room_id: "r7" }] };
    const action: EditAction = {
      kind: "apply",
      added: [{ subjectId: "math", day: "Tue", slot: 2, roomId: "r7" }],
      replaced: [],
      removed: [{ subjectId: "math", day: "Mon", slot: 1, roomId: "r7" }],
    };
    const h = harness(doc);
    invertAction(action, h.exec);
    expect(h.pins()).toEqual([{ subject_id: "math", day: "Mon", slot: 1, room_id: "r7" }]);
  });

  it("redo of an apply recomputes through reapply", () => {
    const h = harness({});
    replayAction({ kind: "apply", added: [], replaced: [], removed: [] }, h.exec);
    expect(h.log).toEqual(["reapply"]);
  });
});
