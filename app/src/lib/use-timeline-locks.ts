import { useMemo } from "react";
import { blockAnchor, expandLockedKeys, scheduleKey } from "./grid";
import type { ProblemEntities } from "./entities";
import type { ScheduleEntry } from "./solver-client";

/** Block size per subject id (consecutive hours) - the map every block-aware
    layer shares (locks, manual edits, drag geometry). */
export function subjectBlockSizes(entities: ProblemEntities | null): Map<string, number> {
  return new Map((entities?.subjects ?? []).map((subject) => [subject.id, subject.consecutiveHours]));
}

/** Pin/unpin semantics for the timeline. The solver reads a pre_assignment
    on a consecutive-hours subject as the block START slot, while users
    right-click any slot of a rendered block - so writes anchor to the start
    entry, and the locked-key set is expanded back over every slot a pinned
    block covers (styling + Pin/Unpin menu toggle + Inspector badge). */
export function useTimelineLocks(
  entities: ProblemEntities | null,
  schedule: ScheduleEntry[],
  pin: (entry: ScheduleEntry) => void,
  unpin: (entry: ScheduleEntry) => void,
) {
  const blockSizes = useMemo(() => subjectBlockSizes(entities), [entities]);

  const lockedKeys = useMemo(() => {
    const pins = new Set(
      (entities?.preAssignments ?? []).map((p) => scheduleKey(p.subjectId, p.day, p.slot)),
    );
    return expandLockedKeys(schedule, pins, blockSizes);
  }, [entities, schedule, blockSizes]);

  const toAnchor = (entry: ScheduleEntry) => blockAnchor(schedule, entry, blockSizes);
  const pinBlock = (entry: ScheduleEntry) => pin(toAnchor(entry));
  const unpinBlock = (entry: ScheduleEntry) => unpin(toAnchor(entry));

  /** Pin or unpin depending on the entry's current lock state ("L" key). */
  const toggleLock = (entry: ScheduleEntry) => {
    const locked = lockedKeys.has(scheduleKey(entry.subject_id, entry.day, entry.slot));
    (locked ? unpinBlock : pinBlock)(entry);
  };

  return { lockedKeys, pinBlock, unpinBlock, toggleLock };
}
