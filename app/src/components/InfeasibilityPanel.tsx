import { CheckCircle2, RotateCcw, Wand2 } from "lucide-react";
import type { ProblemDoc } from "../lib/problem-doc";
import { isSoftened, type RuleConflict, type RuleRef } from "../lib/soften";

/** Friendly names for the 5 softenable kinds (backend RuleRef.kind values). */
const KIND_LABELS: Record<string, string> = {
  break: "Scheduled break",
  allowed_slots: "Allowed slots",
  teacher_cap: "Daily teaching cap",
  same_day: "Different days",
  ordering: "Running order",
};

const CARD =
  "rounded-2xl border border-red-100 bg-red-50 shadow-sm dark:border-red-900/50 dark:bg-red-950/20";
const SOFTEN_BUTTON =
  "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 " +
  "text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 " +
  "dark:border-red-900/50 dark:bg-neutral-900 dark:text-red-300 dark:hover:bg-red-950/40";
const RUN_BUTTON =
  "inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold " +
  "text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-40";

/** Infeasible-solve escape hatch (M7.3): one card per clashing hard rule with a
    one-click "Soften to preference". Softening writes through the keep-result
    channel, so the panel stays up until the user re-solves; a softened rule is
    priced as a weighted preference and can never itself cause infeasibility. */
export function InfeasibilityPanel({
  doc,
  conflicts,
  busy,
  onSoften,
  onRun,
}: {
  doc: ProblemDoc;
  conflicts: RuleConflict[];
  busy: boolean;
  onSoften: (ref: RuleRef) => void;
  onRun: () => void;
}) {
  const softened = conflicts.filter((c) => isSoftened(doc, c.ref.kind, c.ref.key)).length;
  return (
    <section className={`${CARD} space-y-4 p-5`} data-tour="solver-conflicts">
      <div>
        <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">These rules clash</h3>
        <p className="mt-1 text-xs leading-relaxed text-red-700 dark:text-red-300">
          No timetable can satisfy all of them at once. Soften one to make it a preference the scheduler
          honors when possible instead of a rule it can never break.
        </p>
      </div>

      <ul className="space-y-2">
        {conflicts.map((conflict) => {
          const done = isSoftened(doc, conflict.ref.kind, conflict.ref.key);
          return (
            <li
              key={`${conflict.ref.kind}-${conflict.ref.key}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-white p-3 dark:border-red-900/40 dark:bg-neutral-900"
            >
              <div className="min-w-0">
                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600 dark:text-red-400">
                  {KIND_LABELS[conflict.ref.kind] ?? conflict.ref.kind}
                </span>
                <div className="mt-1 truncate text-xs text-neutral-700 dark:text-neutral-300">
                  {conflict.description}
                </div>
              </div>
              {done ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-teal-400">
                  <CheckCircle2 size={14} />
                  Now a preference
                </span>
              ) : (
                <button type="button" onClick={() => onSoften(conflict.ref)} className={SOFTEN_BUTTON}>
                  <Wand2 size={14} />
                  Soften to preference
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {softened > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-red-100 pt-3 dark:border-red-900/40">
          <p className="text-xs text-red-700 dark:text-red-300">
            {softened} of {conflicts.length} softened. Run the scheduler again to use the new preference
            {softened > 1 ? "s" : ""}.
          </p>
          <button type="button" onClick={onRun} disabled={busy} className={RUN_BUTTON}>
            <RotateCcw size={16} />
            Run again
          </button>
        </div>
      )}
    </section>
  );
}
