import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, PencilLine, RotateCcw } from "lucide-react";
import type { Conflict } from "../lib/conflicts";

export interface ConflictStripProps {
  moveCount: number;
  conflicts: Conflict[];
  /** The solve's quality score (null when the solver did not report one). */
  baseQuality: number | null;
  /** Re-priced quality of the edited schedule (null while in flight). */
  editedQuality: number | null;
  onReset: () => void;
}

/** Status strip for a manually edited timetable: how many moves, what they
    broke, and what the backend now thinks the schedule is worth. */
export function ConflictStrip({
  moveCount,
  conflicts,
  baseQuality,
  editedQuality,
  onReset,
}: ConflictStripProps) {
  const [open, setOpen] = useState(false);
  if (moveCount === 0 && conflicts.length === 0) return null;
  const conflicted = conflicts.length > 0;
  const frame = conflicted ? "border-rose-500/40 bg-rose-500/5" : "border-indigo-500/30 bg-indigo-500/5";
  return (
    <div className={`mx-8 mt-4 rounded-xl border px-4 py-2.5 text-sm ${frame}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <PencilLine size={15} className={conflicted ? "text-rose-500" : "text-indigo-500"} />
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
          Edited copy - {moveCount} {moveCount === 1 ? "move" : "moves"}
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
    </div>
  );
}
