import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { SoftConstraintDef } from "../lib/constraint-catalog";
import { ImportanceMeter } from "./ImportanceMeter";

const CARD =
  "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm";

export interface ConstraintImpact {
  satisfied: boolean;
  /** Share (0-100) of the total post-solve penalty this constraint accounts for. */
  share: number;
}

/** One soft-constraint card: importance meter (default) or raw weight (advanced),
    plus a post-solve impact line for scored constraints once a score is in. */
export function SoftConstraintCard({
  def,
  weight,
  advanced,
  onWeightChange,
  impact,
}: {
  def: SoftConstraintDef;
  weight: number;
  advanced: boolean;
  onWeightChange: (weight: number) => void;
  impact: ConstraintImpact | null;
}) {
  // A local draft lets the field hold a transient empty/partial value mid-edit
  // without committing weight 0 (which would invalidate the solve). Valid input
  // commits immediately; blur snaps the field back to the stored weight.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{def.label}</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">{def.description}</div>
        </div>
        {advanced ? (
          <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            Weight
            <input
              type="number"
              min={0}
              max={100}
              value={draft ?? String(weight)}
              onChange={(event) => {
                setDraft(event.target.value);
                if (event.target.value.trim() !== "") onWeightChange(clampWeight(event.target.value));
              }}
              onBlur={() => setDraft(null)}
              className="w-16 rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none dark:border-neutral-700"
            />
          </label>
        ) : (
          <ImportanceMeter weight={weight} onChange={onWeightChange} />
        )}
      </div>
      {impact && <ImpactLine impact={impact} />}
    </div>
  );
}

function ImpactLine({ impact }: { impact: ConstraintImpact }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
      {impact.satisfied ? (
        <span className="flex items-center gap-1 whitespace-nowrap text-sm font-medium text-teal-600 dark:text-teal-400">
          <CheckCircle2 size={14} /> Fully satisfied
        </span>
      ) : (
        <span className="flex items-center gap-1 whitespace-nowrap text-sm font-medium text-amber-600 dark:text-amber-400">
          <AlertCircle size={14} /> {impact.share}% of total impact
        </span>
      )}
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full ${impact.satisfied ? "bg-teal-500" : "bg-amber-500"}`}
          style={{ width: `${impact.satisfied ? 0 : impact.share}%` }}
        />
      </div>
    </div>
  );
}

function clampWeight(raw: string): number {
  const value = Math.round(Number(raw));
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
