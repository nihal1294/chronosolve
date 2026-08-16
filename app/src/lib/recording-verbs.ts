import type { EditAction } from "./edit-history";
import type { ManualOverride } from "./overrides";
import type { ManualEdits } from "./use-manual-edits";

/** The session verbs wrapped so every real change lands in the undo history.
    Extracted from use-edit-session so that hook stays inside the file size
    limit, and so the recording rule is testable without mounting a hook.

    Verbs push history ONLY when the override log actually changed - a no-op
    drop, a re-picked room, a refused (pinned) unplace, and a Put back at an
    index holding no unplace all return null. Otherwise the history tail and
    the log misalign, and undo pops a REAL override for an action that did
    nothing.

    popOverride, pushOverride and insertOverride pass through untouched: they
    ARE the undo/redo executors, and recording them would push new history
    while stepping through the existing history. */
export function recordingEdits(edits: ManualEdits, record: (action: EditAction) => void): ManualEdits {
  const push = (kind: "move" | "room" | "unplace", override: ManualOverride | null) => {
    if (override) record({ kind, override });
    return override;
  };
  return {
    ...edits,
    moveSession: (entry, to) => push("move", edits.moveSession(entry, to)),
    roomSession: (entry, roomId) => push("room", edits.roomSession(entry, roomId)),
    unplaceSession: (entry, lockedKeys) => push("unplace", edits.unplaceSession(entry, lockedKeys)),
    removeUnplaceAt: (index) => {
      const removed = edits.removeUnplaceAt(index);
      if (removed) record({ kind: "putback", removed, index });
      return removed;
    },
  };
}
