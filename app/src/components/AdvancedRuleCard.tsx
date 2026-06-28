import { Trash2 } from "lucide-react";
import { ImportanceMeter } from "./ImportanceMeter";
import { summarizeParams, type NameMaps } from "../lib/rule-format";
import type { RuleInstance, RuleTemplate } from "../lib/rule-templates";

const CARD =
  "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm";

/** One authored advanced rule: hard/soft badge, plain-language summary, the shared
    importance meter for soft rules, and delete. Cards are derive()d from config, so
    rendering one never owns state - edits flow back through onWeightChange/onDelete. */
export function AdvancedRuleCard({
  template,
  instance,
  names,
  weight,
  onWeightChange,
  onDelete,
}: {
  template: RuleTemplate;
  instance: RuleInstance;
  names: NameMaps;
  weight?: number;
  onWeightChange?: (weight: number) => void;
  onDelete: () => void;
}) {
  const summary = summarizeParams(template, instance, names);
  const badge =
    template.mode === "hard"
      ? "bg-red-500/10 text-red-600 dark:text-red-400"
      : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return (
    <div className={`${CARD} flex items-center justify-between gap-4 p-4`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badge}`}>
            {template.mode}
          </span>
          <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {template.label}
          </span>
        </div>
        {summary && (
          <div className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">{summary}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {template.mode === "soft" && weight !== undefined && onWeightChange && (
          <ImportanceMeter weight={weight} onChange={onWeightChange} />
        )}
        <button
          type="button"
          aria-label="Delete rule"
          onClick={onDelete}
          className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-neutral-800"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
