/** Cascade for entity deletion: removing an entity also removes every advanced
    rule instance, softened ref (M7.3), and pin that references its id. Without
    this, dangling ids block validation after a delete, and re-using the id
    later would inherit a stale softened state (soften.ts matches kind+key).

    Index-keyed pair lists (same_day_exclusions, orderings) go through
    removeIndexKeyedRule so surviving softened refs are re-keyed; id-keyed
    cleanup (teacher caps, allowed_slots) drops entries and refs directly.
    Every write is guarded so an unreferenced delete changes nothing. */

import {
  getAdvancedList,
  getTeacherCaps,
  removeEntity,
  setAdvancedList,
  setTeacherCap,
  type EntitySection,
  type ProblemDoc,
} from "./problem-doc";
import { isSoftened, removeIndexKeyedRule, removeSoftened } from "./soften";

const refIs = (entry: unknown, field: string, id: string): boolean =>
  typeof entry === "object" && entry !== null && (entry as Record<string, unknown>)[field] === id;

function filterAdvancedList(doc: ProblemDoc, key: string, keep: (entry: unknown) => boolean): ProblemDoc {
  const list = getAdvancedList(doc, key);
  const kept = list.filter(keep);
  return kept.length === list.length ? doc : setAdvancedList(doc, key, kept);
}

function dropSoftened(doc: ProblemDoc, kind: string, key: string): ProblemDoc {
  return isSoftened(doc, kind, key) ? removeSoftened(doc, { kind, key }) : doc;
}

/** Remove pairs naming the subject one at a time (indices shift per removal)
    so removeIndexKeyedRule can re-key the surviving softened refs each step. */
function removePairsNaming(doc: ProblemDoc, listKey: string, kind: string, id: string): ProblemDoc {
  let next = doc;
  for (;;) {
    const index = getAdvancedList(next, listKey).findIndex(
      (entry) => refIs(entry, "first", id) || refIs(entry, "second", id),
    );
    if (index === -1) return next;
    next = removeIndexKeyedRule(next, listKey, kind, index);
  }
}

/** Prune the subject from reservation subject lists; a reservation left empty
    is dropped whole (it would otherwise reserve its room for nothing, blocking
    the room outright - not something the user authored). */
function pruneSubjectFromReservations(doc: ProblemDoc, id: string): ProblemDoc {
  let changed = false;
  const kept: unknown[] = [];
  for (const entry of getAdvancedList(doc, "room_reservations")) {
    const ids = (entry as { subject_ids?: unknown } | null)?.subject_ids;
    if (!Array.isArray(ids) || !ids.includes(id)) {
      kept.push(entry);
      continue;
    }
    changed = true;
    const remaining = ids.filter((sid) => sid !== id);
    if (remaining.length > 0) kept.push({ ...(entry as object), subject_ids: remaining });
  }
  return changed ? setAdvancedList(doc, "room_reservations", kept) : doc;
}

/** Pins reference subjects like advanced rules do; a deleted subject's pins
    would otherwise fail backend validation as unknown ids. */
function dropSubjectPins(doc: ProblemDoc, id: string): ProblemDoc {
  if (!Array.isArray(doc.pre_assignments)) return doc;
  const kept = doc.pre_assignments.filter((entry) => !refIs(entry, "subject_id", id));
  return kept.length === doc.pre_assignments.length ? doc : { ...doc, pre_assignments: kept };
}

function cascadeTeacher(doc: ProblemDoc, id: string): ProblemDoc {
  const next = id in getTeacherCaps(doc) ? setTeacherCap(doc, id, null) : doc;
  return dropSoftened(next, "teacher_cap", id);
}

function cascadeSubject(doc: ProblemDoc, id: string): ProblemDoc {
  let next = removePairsNaming(doc, "same_day_exclusions", "same_day", id);
  next = removePairsNaming(next, "orderings", "ordering", id);
  next = filterAdvancedList(next, "same_room_subjects", (sid) => sid !== id);
  next = pruneSubjectFromReservations(next, id);
  next = dropSoftened(next, "allowed_slots", id);
  return dropSubjectPins(next, id);
}

function cascadeRoom(doc: ProblemDoc, id: string): ProblemDoc {
  return filterAdvancedList(doc, "room_reservations", (entry) => !refIs(entry, "room_id", id));
}

function cascadeGroup(doc: ProblemDoc, id: string): ProblemDoc {
  return filterAdvancedList(doc, "group_free_halfdays", (entry) => !refIs(entry, "group_id", id));
}

const CASCADES: Record<EntitySection, (doc: ProblemDoc, id: string) => ProblemDoc> = {
  teachers: cascadeTeacher,
  subjects: cascadeSubject,
  rooms: cascadeRoom,
  student_groups: cascadeGroup,
};

/** Remove an entity AND everything that references it - the one deletion
    entry point the app should use (use-entity-editing.ts remove path). */
export function removeEntityAndRefs(doc: ProblemDoc, section: EntitySection, id: string): ProblemDoc {
  return CASCADES[section](removeEntity(doc, section, id), id);
}
