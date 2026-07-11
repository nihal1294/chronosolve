import type { ScheduleEntry } from "./solver-client";
import type { PreAssignment } from "./entities";
import { scheduleKey } from "./grid";

/** One manual placement decision. `from` is the block ANCHOR (start slot)
    the session occupied when the user made the move; `to` is the new anchor.
    Room and lock override kinds arrive in M8c. */
export interface MoveOverride {
  kind: "move";
  subjectId: string;
  from: { day: string; slot: number };
  to: { day: string; slot: number };
}

export type ManualOverride = MoveOverride;

/** The shown schedule with every override applied, in order. Pure: the
    solver result is never mutated, so clearing overrides restores it. */
export function applyOverrides(
  schedule: ScheduleEntry[],
  overrides: ManualOverride[],
  blockSizes: ReadonlyMap<string, number>,
): ScheduleEntry[] {
  let current = schedule;
  for (const override of overrides) current = applyMove(current, override, blockSizes);
  return current;
}

function applyMove(
  schedule: ScheduleEntry[],
  move: MoveOverride,
  blockSizes: ReadonlyMap<string, number>,
): ScheduleEntry[] {
  const size = blockSizes.get(move.subjectId) ?? 1;
  const sourceKeys = new Set(
    Array.from({ length: size }, (_, i) => scheduleKey(move.subjectId, move.from.day, move.from.slot + i)),
  );
  const template = schedule.find((e) => sourceKeys.has(scheduleKey(e.subject_id, e.day, e.slot)));
  if (!template) return schedule; // stale: the block is no longer at `from`
  const kept = schedule.filter((e) => !sourceKeys.has(scheduleKey(e.subject_id, e.day, e.slot)));
  const moved = Array.from({ length: size }, (_, i) => ({
    ...template,
    day: move.to.day,
    slot: move.to.slot + i,
  }));
  return [...kept, ...moved];
}

/** Final resting pin per moved subject (block-start semantics, matching
    pre_assignments). Sorted for stable serialization; M8c feeds these
    through problem-doc pinAssignment on save. */
export function overridesToPreAssignments(overrides: ManualOverride[]): PreAssignment[] {
  const final = new Map<string, PreAssignment>();
  for (const o of overrides) {
    final.set(o.subjectId, { subjectId: o.subjectId, day: o.to.day, slot: o.to.slot });
  }
  return [...final.values()].sort((a, b) => a.subjectId.localeCompare(b.subjectId));
}
