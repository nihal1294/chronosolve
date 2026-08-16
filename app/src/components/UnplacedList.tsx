import { CornerUpLeft, PackageOpen } from "lucide-react";

/** One tray row, already formatted by the route (which owns the subject-name
    and slot-label lookups). `index` is the override's position in the edit
    log - Put back removes exactly that entry, not the row's place in this
    list, so the two must not be conflated. */
export interface UnplacedRow {
  index: number;
  label: string;
  /** Another occurrence of this subject now holds the slot it left, and one
      subject cannot hold a slot twice - move that one first. */
  blocked: boolean;
}

interface UnplacedListProps {
  rows: UnplacedRow[];
  onPutBack: (index: number) => void;
}

/** The sessions currently off the grid. Each is un-decided: it carries no pin,
    so "Re-run with locks" lets the scheduler place it anywhere - or Put back
    returns it to the slot it left. */
export function UnplacedList({ rows, onPutBack }: UnplacedListProps) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-2 border-t border-neutral-200/70 pt-2 dark:border-neutral-700/60">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
        <PackageOpen size={13} />
        Unplaced ({rows.length})
      </div>
      <ul className="mt-1 space-y-1 pl-5">
        {rows.map((row) => (
          <li key={row.index} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-neutral-700 dark:text-neutral-300">{row.label}</span>
            <button
              onClick={() => onPutBack(row.index)}
              disabled={row.blocked}
              title={
                row.blocked
                  ? "Another session of this subject now holds that slot - move it first"
                  : undefined
              }
              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-1.5 py-0.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:disabled:hover:bg-transparent"
            >
              <CornerUpLeft size={11} />
              Put back
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
