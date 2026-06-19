import {
  IMPORTANCE_BANDS,
  bandLabel,
  importanceToWeight,
  weightToImportance,
} from "../lib/constraint-importance";

/** Five-segment importance gauge over a 0-100 weight. Clicking a segment sets the
    weight to that band's canonical stop; the label names the active band. */
export function ImportanceMeter({
  weight,
  onChange,
}: {
  weight: number;
  onChange: (weight: number) => void;
}) {
  const active = weightToImportance(weight);
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-right text-xs font-medium text-indigo-600 dark:text-indigo-400">
        {bandLabel(weight)}
      </span>
      <div className="flex gap-1" role="group" aria-label="Importance">
        {IMPORTANCE_BANDS.map((band, index) => (
          <button
            key={band.label}
            type="button"
            title={band.label}
            aria-pressed={index <= active}
            onClick={() => onChange(importanceToWeight(index))}
            className={`h-4 w-3 rounded-sm transition-colors ${
              index <= active ? "bg-indigo-500" : "bg-neutral-200 dark:bg-neutral-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
