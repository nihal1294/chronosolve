import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  PencilLine,
  Pin,
  Play,
  Redo2,
  RotateCcw,
  Undo2,
} from "lucide-react";
import type { Conflict } from "../lib/conflicts";
import { UnplacedList, type UnplacedRow } from "./UnplacedList";

const ICON_BUTTON =
  "rounded-lg border border-neutral-300 p-1.5 text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";

export interface ConflictStripProps {
  editCount: number;
  conflicts: Conflict[];
  /** The solve's quality score (null when the solver did not report one). */
  baseQuality: number | null;
  /** Re-priced quality of the edited schedule (null while in flight). */
  editedQuality: number | null;
  /** Session pins the doc does not carry yet (the Apply badge number). */
  unappliedCount: number;
  /** Apply has a doc change to write. NOT `unappliedCount > 0`: an unplace
      writes no pin but does remove one, so the count can sit at 0 with a real
      doc change pending. */
  canApply: boolean;
  /** Sessions currently off the grid, formatted by the route. */
  unplaced: UnplacedRow[];
  onPutBack: (index: number) => void;
  /** A solve is running (disables the re-run verb). */
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onApply: () => void;
  /** Apply the edits as locks, then reschedule everything else around them. */
  onReSolve: () => void;
  onReset: () => void;
}

/** Status strip for a manually edited timetable: how many edits (moves and
    room changes), what they broke, what the backend now thinks the schedule
    is worth, and the Apply/Reset verbs. */
export function ConflictStrip({
  editCount,
  conflicts,
  baseQuality,
  editedQuality,
  unappliedCount,
  canApply,
  unplaced,
  onPutBack,
  busy,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onApply,
  onReSolve,
  onReset,
}: ConflictStripProps) {
  const [open, setOpen] = useState(false);
  // Stays visible while undo state remains: a fully undone session (0 edits)
  // still needs its Redo button reachable. An unplace IS an override, so
  // editCount already keeps the strip mounted while the tray has rows.
  if (editCount === 0 && conflicts.length === 0 && !canUndo && !canRedo) return null;
  const conflicted = conflicts.length > 0;
  const frame = conflicted ? "border-rose-500/40 bg-rose-500/5" : "border-indigo-500/30 bg-indigo-500/5";
  return (
    <div className={`mx-8 mt-4 rounded-xl border px-4 py-2.5 text-sm ${frame}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <PencilLine size={15} className={conflicted ? "text-rose-500" : "text-indigo-500"} />
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
          Edited copy - {editCount} {editCount === 1 ? "edit" : "edits"}
        </span>
        {conflicted ? (
          <button
            onClick={() => setOpen((was) => !was)}
            className="inline-flex items-center gap-1 font-semibold text-rose-600 transition-colors hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {conflicts.length} {conflicts.length === 1 ? "conflict" : "conflicts"}
          </button>
        ) : (
          <span className="text-neutral-500 dark:text-neutral-400">no conflicts</span>
        )}
        <span className="ml-auto font-mono text-xs text-neutral-600 dark:text-neutral-400">
          Quality: {baseQuality !== null ? `${baseQuality} → ` : ""}
          {editedQuality ?? "..."}
        </span>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo edit"
          title="Undo (⌘Z)"
          className={ICON_BUTTON}
        >
          <Undo2 size={12} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo edit"
          title="Redo (⇧⌘Z)"
          className={ICON_BUTTON}
        >
          <Redo2 size={12} />
        </button>
        <button
          onClick={onReSolve}
          disabled={busy}
          title="Apply your edits as locked sessions, then reschedule everything else around them"
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/50 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-500/10 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent dark:border-indigo-500/40 dark:text-indigo-300"
        >
          <Play size={12} />
          Re-run with locks
        </button>
        <button
          onClick={onApply}
          disabled={!canApply}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/50 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-500/10 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent dark:border-indigo-500/40 dark:text-indigo-300"
        >
          <Pin size={12} />
          Apply edits{unappliedCount > 0 ? ` (${unappliedCount})` : ""}
        </button>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <RotateCcw size={12} />
          Reset edits
        </button>
      </div>
      {open && conflicted && (
        <ul className="mt-2 space-y-1 pl-7">
          {conflicts.map((conflict, index) => (
            <li
              key={`${conflict.kind}|${index}`}
              className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300"
            >
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {conflict.message}
            </li>
          ))}
        </ul>
      )}
      <UnplacedList rows={unplaced} onPutBack={onPutBack} />
    </div>
  );
}
