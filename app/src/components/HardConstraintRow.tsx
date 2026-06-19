import { AlertTriangle } from "lucide-react";
import type { HardConstraintDef } from "../lib/constraint-catalog";

/** One hard-constraint toggle. When a caution rule is switched off, an amber note
    warns the solver may now break it. */
export function HardConstraintRow({
  def,
  checked,
  onToggle,
}: {
  def: HardConstraintDef;
  checked: boolean;
  onToggle: (value: boolean) => void;
}) {
  const warn = def.caution && !checked;
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{def.label}</div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">{def.description}</div>
        {warn && (
          <div className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle size={12} />
            Off - the timetable may break this rule.
          </div>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onToggle(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-indigo-600" : "bg-neutral-300 dark:bg-neutral-700"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
