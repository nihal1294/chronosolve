import type { PreAssignment } from "./entities";
import type { ManualOverride } from "./overrides";
import { pinAssignment, unpinAssignment, type PinSlot, type ProblemDoc } from "./problem-doc";

const pinList = (doc: ProblemDoc): Record<string, unknown>[] =>
  Array.isArray(doc.pre_assignments) ? (doc.pre_assignments as Record<string, unknown>[]) : [];

function docPinAt(doc: ProblemDoc, subjectId: string, day: string, slot: number): PinSlot | null {
  const raw = pinList(doc).find((e) => e.subject_id === subjectId && e.day === day && e.slot === slot);
  if (!raw) return null;
  return { subjectId, day, slot, ...(typeof raw.room_id === "string" ? { roomId: raw.room_id } : {}) };
}

/** The "Apply edits" doc model: one block-anchor pin per moved/room-changed
    occurrence (`pins`, room carried along move chains), plus the DOC pins a
    move left behind (`stale`). Apply must remove stale pins - a one-hour
    subject pinned at its old AND new slot makes every solve infeasible - and
    a doc pin's room follows its session: the chain's final pin inherits it
    unless a room override set one later. A chain landing back on its own
    unchanged doc pin cancels both sides (no doc churn). */
export function applyPlan(
  doc: ProblemDoc,
  overrides: ManualOverride[],
): { pins: PreAssignment[]; stale: PinSlot[] } {
  const at = (subject: string, day: string, slot: number) => `${subject}|${day}|${slot}`;
  const pins = new Map<string, PreAssignment>();
  const stale = new Map<string, PinSlot>();
  for (const o of overrides) {
    if (o.kind === "room") {
      pins.set(at(o.subjectId, o.at.day, o.at.slot), {
        subjectId: o.subjectId,
        day: o.at.day,
        slot: o.at.slot,
        roomId: o.roomId,
      });
      continue;
    }
    const fromKey = at(o.subjectId, o.from.day, o.from.slot);
    const prior = pins.get(fromKey);
    const docPrior = docPinAt(doc, o.subjectId, o.from.day, o.from.slot);
    if (docPrior) stale.set(fromKey, docPrior);
    pins.delete(fromKey);
    const roomId = prior?.roomId !== undefined ? prior.roomId : docPrior?.roomId;
    pins.set(at(o.subjectId, o.to.day, o.to.slot), {
      subjectId: o.subjectId,
      day: o.to.day,
      slot: o.to.slot,
      ...(roomId === undefined ? {} : { roomId }),
    });
  }
  for (const [key, pin] of stale) {
    if (pins.get(key)?.roomId === pin.roomId) stale.delete(key);
  }
  const ordered = [...pins.values()].sort(
    (a, b) => a.subjectId.localeCompare(b.subjectId) || a.day.localeCompare(b.day) || a.slot - b.slot,
  );
  return { pins: ordered, stale: [...stale.values()] };
}

/** The override log's pins alone (no doc): serialization order and chain
    semantics; applyPlan adds the doc-aware staleness and room inheritance. */
export function overridesToPreAssignments(overrides: ManualOverride[]): PreAssignment[] {
  return applyPlan({}, overrides).pins;
}

/** Fold the session's pins into the doc ("Apply edits"). Upserts through
    pinAssignment; returns the SAME doc object when every pin is already
    present so callers can skip the doc write entirely. */
export function applyPins(doc: ProblemDoc, pins: PinSlot[]): ProblemDoc {
  let current = doc;
  let changed = false;
  for (const pin of pins) {
    const next = pinAssignment(current, pin);
    // pinAssignment's no-op contract: new doc object, SAME list reference.
    if (next.pre_assignments !== current.pre_assignments) {
      current = next;
      changed = true;
    }
  }
  return changed ? current : doc;
}

/** The full Apply fold as one pure step: stale source pins come OFF before
    the destination pins go on, so a moved doc pin is relocated - never
    doubled into an unsolvable two-slot requirement. `next` is the doc both
    the Apply button and a re-run-with-locks must submit; it keeps the input
    doc's identity when nothing changes (callers skip the doc write). */
export function planApplyDoc(
  doc: ProblemDoc,
  overrides: ManualOverride[],
): { pins: PreAssignment[]; stale: PinSlot[]; next: ProblemDoc } {
  const { pins, stale } = applyPlan(doc, overrides);
  const cleared = stale.reduce((d, pin) => unpinAssignment(d, pin), doc);
  return { pins, stale, next: applyPins(cleared, pins) };
}

/** What Apply would upsert: pins absent from the doc (`added`) and the PRIOR
    versions of pins whose room it would overwrite (`replaced`) - the undo
    payload for an apply action alongside applyPlan's `stale` (removed pins).
    Mirrors pinAssignment's upsert rule exactly, so added/replaced are
    non-empty iff applyPins returns a new doc (contract-tested). Assumes
    unique slot triples per pin, which applyPlan guarantees. */
export function pinDiff(doc: ProblemDoc, pins: PinSlot[]): { added: PinSlot[]; replaced: PinSlot[] } {
  const list = pinList(doc);
  const added: PinSlot[] = [];
  const replaced: PinSlot[] = [];
  for (const pin of pins) {
    const prior = list.find(
      (e) => e.subject_id === pin.subjectId && e.day === pin.day && e.slot === pin.slot,
    );
    if (!prior) added.push(pin);
    else if (pin.roomId !== undefined && prior.room_id !== pin.roomId) {
      replaced.push({
        subjectId: pin.subjectId,
        day: pin.day,
        slot: pin.slot,
        ...(typeof prior.room_id === "string" ? { roomId: prior.room_id } : {}),
      });
    }
  }
  return { added, replaced };
}

/** How many session pins Apply would still write (badge + save warning) -
    exactly pinDiff's added/replaced count over the doc-aware plan, so the
    badge, the history payload, and applyPins' no-op rule can never disagree.
    A pin with a different room counts (it would re-solve away from what the
    screen shows); a roomless pin is satisfied by any doc pin at its slot. */
export function unappliedPinCount(doc: ProblemDoc, overrides: ManualOverride[]): number {
  const { added, replaced } = pinDiff(doc, applyPlan(doc, overrides).pins);
  return added.length + replaced.length;
}
