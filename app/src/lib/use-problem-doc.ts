import { useCallback, useMemo, useState } from "react";
import { parseDoc, serializeDoc, type ProblemDoc } from "./problem-doc";

/** Shown in the editor after a structured edit regenerates the YAML text. */
export const REGENERATED_HINT =
  "Edited via the UI - the YAML was regenerated, so comments and manual formatting were replaced.";

export interface DocParseResult {
  doc: ProblemDoc | null;
  parseError: string | null;
}

/** Editor-facing parse policy: blank text means "no document yet" (not an
    empty doc), and any failure is reduced to its one-line summary so it can
    render in the editor's notice badge. */
export function tryParseDoc(yamlText: string): DocParseResult {
  if (!yamlText.trim()) return { doc: null, parseError: null };
  try {
    return { doc: parseDoc(yamlText), parseError: null };
  } catch (problem) {
    const message = problem instanceof Error ? problem.message.split("\n")[0] : String(problem);
    return { doc: null, parseError: message };
  }
}

/** Canonical editing state for the problem definition.

    The YAML text is what the user sees and types; the doc parsed from it is
    what the structured editors and the solver consume. Edits flow one way
    per writer: typing replaces the text (doc re-derives), while structured
    edits replace the doc and the text is regenerated from it. */
export function useProblemDoc() {
  const [yamlText, setYamlText] = useState("");
  const [regenerated, setRegenerated] = useState(false);

  const { doc, parseError } = useMemo(() => tryParseDoc(yamlText), [yamlText]);

  // Typing (or loading a template) makes the raw text authoritative again.
  const editYaml = useCallback((text: string) => {
    setYamlText(text);
    setRegenerated(false);
  }, []);

  // Structured edits (entity dialogs, constraint toggles, block pinning)
  // write the doc; the visible YAML is derived from it.
  const applyDocEdit = useCallback((next: ProblemDoc) => {
    setYamlText(serializeDoc(next));
    setRegenerated(true);
  }, []);

  return { yamlText, doc, parseError, regenerated, editYaml, applyDocEdit };
}
