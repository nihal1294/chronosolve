import { useEffect, useState } from "react";
import type { ProblemDoc } from "./problem-doc";
import { solverClient, type ValidationReport } from "./solver-client";

/** Debounce window: doc edits can arrive in bursts (a soft-weight slider drag,
 *  rapid rule authoring), so we validate only the settled value. */
const DEBOUNCE_MS = 400;

interface Validated {
  /** The exact doc this report was computed for (identity-compared). */
  doc: ProblemDoc | null;
  report: ValidationReport | null;
}

/** Debounced pre-solve /validate for the current doc. Returns the latest report
 *  (the errors + warnings the solver would raise before it even starts), or null
 *  while that is unknown - no doc, the report is still in flight, or the sidecar
 *  could not be reached.
 *
 *  The result is tagged with the doc it belongs to and only surfaced while that
 *  doc is still the current one (mirrors the score check in ConstraintEngineRoute),
 *  so an edit clears the banner immediately rather than leaving the previous doc's
 *  messages on screen through the debounce + fetch.
 *
 *  A transport failure resolves to null on purpose: "can't reach the sidecar"
 *  (including the ~6s cold-start warmup) is not the same as "your problem is
 *  invalid", so we never turn an infra hiccup into a scary validation banner. */
export function useDocValidation(doc: ProblemDoc | null): ValidationReport | null {
  const [state, setState] = useState<Validated>({ doc: null, report: null });

  useEffect(() => {
    if (!doc) return; // nothing to validate; the identity gate below already returns null
    let active = true; // a newer edit (or unmount) retires this run before it can set state
    const timer = setTimeout(() => {
      solverClient
        .validate(doc)
        .then((report) => active && setState({ doc, report }))
        .catch(() => active && setState({ doc, report: null }));
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [doc]);

  return state.doc === doc ? state.report : null;
}
