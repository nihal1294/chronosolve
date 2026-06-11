import { useState } from "react";
import {
  listEntities,
  pinAssignment,
  removeEntity,
  unpinAssignment,
  upsertEntity,
  type Entity,
  type EntitySection,
  type PinSlot,
  type ProblemDoc,
} from "./problem-doc";
import { sectionForKind, type EntityKind } from "./entity-forms";
import type { ScheduleEntry } from "./solver-client";

export interface EditorTarget {
  section: EntitySection;
  /** null = create mode. */
  initial: Entity | null;
}

const toPin = (entry: ScheduleEntry): PinSlot => ({
  subjectId: entry.subject_id,
  day: entry.day,
  slot: entry.slot,
});

/** Dialog target + every doc edit the table and timeline trigger: add/edit/
    delete entities, pin/unpin blocks. All writes flow through applyDocEdit
    so the YAML regenerates from the canonical doc. */
export function useEntityEditing(doc: ProblemDoc | null, applyDocEdit: (next: ProblemDoc) => void) {
  const [target, setTarget] = useState<EditorTarget | null>(null);

  const openAdd = (kind: EntityKind) => setTarget({ section: sectionForKind(kind), initial: null });

  const openEdit = (kind: EntityKind, id: string) => {
    if (!doc) return;
    const section = sectionForKind(kind);
    const initial = listEntities(doc, section).find((entity) => entity.id === id);
    if (initial) setTarget({ section, initial });
  };

  const close = () => setTarget(null);

  const save = (entity: Entity) => {
    if (doc && target) applyDocEdit(upsertEntity(doc, target.section, entity));
  };

  const remove = (kind: EntityKind, id: string) => {
    if (doc) applyDocEdit(removeEntity(doc, sectionForKind(kind), id));
  };

  const pin = (entry: ScheduleEntry) => {
    if (doc) applyDocEdit(pinAssignment(doc, toPin(entry)));
  };

  const unpin = (entry: ScheduleEntry) => {
    if (doc) applyDocEdit(unpinAssignment(doc, toPin(entry)));
  };

  return { target, openAdd, openEdit, close, save, remove, pin, unpin };
}
