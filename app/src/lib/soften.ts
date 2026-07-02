/** M7.3 soften-to-preference: doc-level helpers for demoting one clashing hard
    rule instance to a weighted preference. Kinds, keys, and soft_<kind> weight
    names mirror the backend contract (models/rules.py, solver/rules_hard.py):
    list-index keys for global_breaks / same_day_exclusions / orderings, entity
    ids for allowed_slots (subject) and teacher_cap (teacher). */

import {
  appendAdvancedItem,
  getAdvancedList,
  getSoftWeight,
  setAdvancedList,
  setSoftWeight,
  type ProblemDoc,
} from "./problem-doc";

/** Address of one softenable hard-rule instance (mirrors RuleRef). */
export interface RuleRef {
  kind: string;
  key: string;
}

/** One clashing rule named by an infeasible solve (mirrors RuleConflict). */
export interface RuleConflict {
  ref: RuleRef;
  description: string;
}

/** Weight seeded the first time a rule of a kind is softened. */
export const DEFAULT_SOFT_WEIGHT = 50;

/** The backend prices kind K with weight soft_K - uniform, no lookup table. */
export function weightKeyFor(kind: string): string {
  return `soft_${kind}`;
}

function isRef(value: unknown): value is RuleRef {
  if (typeof value !== "object" || value === null) return false;
  const ref = value as Record<string, unknown>;
  return typeof ref.kind === "string" && typeof ref.key === "string";
}

/** The softened refs ([] when unset; malformed entries dropped). */
export function getSoftened(doc: ProblemDoc): RuleRef[] {
  return getAdvancedList(doc, "softened").filter(isRef);
}

/** Is the (kind, key) instance already demoted to a preference? */
export function isSoftened(doc: ProblemDoc, kind: string, key: string): boolean {
  return getSoftened(doc).some((ref) => ref.kind === kind && ref.key === key);
}

/** Demote one rule instance: append its ref and seed the kind's weight when
    unset (0). Softening an already-softened ref is a no-op. */
export function addSoftened(doc: ProblemDoc, ref: RuleRef): ProblemDoc {
  if (isSoftened(doc, ref.kind, ref.key)) return doc;
  const next = appendAdvancedItem(doc, "softened", { kind: ref.kind, key: ref.key });
  const weightKey = weightKeyFor(ref.kind);
  return getSoftWeight(next, weightKey) === 0 ? setSoftWeight(next, weightKey, DEFAULT_SOFT_WEIGHT) : next;
}

/** Drop one softened ref (the underlying rule instance stays). */
export function removeSoftened(doc: ProblemDoc, ref: RuleRef): ProblemDoc {
  const kept = getSoftened(doc).filter((r) => !(r.kind === ref.kind && r.key === ref.key));
  return setAdvancedList(doc, "softened", kept);
}

/** Remove entry `index` from an index-keyed advanced list (global_breaks,
    same_day_exclusions, orderings) WITHOUT letting softened refs dangle: the
    removed entry's ref is dropped and same-kind refs above it shift down one.
    Id-keyed kinds (allowed_slots, teacher_cap) never need this. */
export function removeIndexKeyedRule(
  doc: ProblemDoc,
  listKey: string,
  kind: string,
  index: number,
): ProblemDoc {
  const list = getAdvancedList(doc, listKey);
  if (index < 0 || index >= list.length) return doc;
  const entries = [...list.slice(0, index), ...list.slice(index + 1)];
  const refs = getSoftened(doc)
    .filter((ref) => !(ref.kind === kind && ref.key === String(index)))
    .map((ref) =>
      ref.kind === kind && Number(ref.key) > index
        ? { kind: ref.kind, key: String(Number(ref.key) - 1) }
        : ref,
    );
  return setAdvancedList(setAdvancedList(doc, listKey, entries), "softened", refs);
}

function nthListIndex(
  doc: ProblemDoc,
  listKey: string,
  kind: string,
  cardIndex: number,
  softened: boolean,
): number {
  let seen = 0;
  const count = getAdvancedList(doc, listKey).length;
  for (let i = 0; i < count; i++) {
    if (isSoftened(doc, kind, String(i)) === softened && seen++ === cardIndex) return i;
  }
  return -1;
}

/** Original list index of the cardIndex-th NON-softened entry (hard cards). */
export function unsoftenedIndex(doc: ProblemDoc, listKey: string, kind: string, cardIndex: number): number {
  return nthListIndex(doc, listKey, kind, cardIndex, false);
}

/** Original list index of the cardIndex-th SOFTENED entry (soft cards). */
export function softenedIndex(doc: ProblemDoc, listKey: string, kind: string, cardIndex: number): number {
  return nthListIndex(doc, listKey, kind, cardIndex, true);
}
