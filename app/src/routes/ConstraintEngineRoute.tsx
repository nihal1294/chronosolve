import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Database, ShieldAlert, Zap } from "lucide-react";
import { useWorkspace } from "../providers/problem-doc-provider";
import { getHardFlag, getSoftWeight, setHardFlag, setSoftWeight, type ProblemDoc } from "../lib/problem-doc";
import { HARD_CONSTRAINTS, SOFT_CONSTRAINTS, type SoftConstraintDef } from "../lib/constraint-catalog";
import { PRESET_NAMES, PRESETS, type PresetName } from "../lib/constraint-importance";
import { impactShares } from "../lib/analytics";
import { solverClient, type QualityReport, type SolveResult } from "../lib/solver-client";
import { HardConstraintRow } from "../components/HardConstraintRow";
import { SoftConstraintCard, type ConstraintImpact } from "../components/SoftConstraintCard";

const card =
  "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700";

interface ScoreState {
  forResult: SolveResult | null;
  report: QualityReport | null;
}

export function ConstraintEngineRoute() {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const doc = ws.doc;
  const result = ws.result;
  const feasible = result !== null && (result.status === "optimal" || result.status === "feasible");
  const [advanced, setAdvanced] = useState(false);
  const [score, setScore] = useState<ScoreState>({ forResult: null, report: null });

  useEffect(() => {
    if (!doc || !result || !feasible || result.schedule.length === 0) return;
    let active = true; // a new result (or unmount) retires this fetch
    solverClient
      .score(doc, result.schedule)
      .then((report) => active && setScore({ forResult: result, report }))
      .catch(() => active && setScore({ forResult: result, report: null }));
    return () => {
      active = false;
    };
  }, [doc, result, feasible]);

  if (!doc) {
    return (
      <div className="relative z-10 flex h-full items-center justify-center p-8" data-tour="constraints">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
            <Database size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            No problem loaded
          </h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Add courses, instructors, rooms, and groups before setting constraints.
          </p>
          <button onClick={() => navigate("/data")} className={`mt-6 ${primary}`}>
            Go to Data
          </button>
        </div>
      </div>
    );
  }

  // A score only counts while it matches the current result (which a constraint
  // edit invalidates), so a stale solve never shows an impact line.
  const metrics = score.forResult === result ? (score.report?.metrics ?? null) : null;
  const shares = metrics ? impactShares(metrics) : null;

  // QualityReport.metrics is keyed by the scorer's short metric name (def.metricKey),
  // not the soft-constraint config key - so the impact line must read metricKey.
  const softImpact = (def: SoftConstraintDef): ConstraintImpact | null => {
    if (!metrics || !def.scored || !def.metricKey) return null;
    const metricScore = metrics[def.metricKey] ?? 100;
    return { satisfied: metricScore >= 100, share: shares?.[def.metricKey] ?? 0 };
  };

  const applyPreset = (name: PresetName) => {
    let next: ProblemDoc = doc;
    for (const [key, weight] of Object.entries(PRESETS[name])) next = setSoftWeight(next, key, weight);
    ws.editProblem(next);
  };
  const activePreset = PRESET_NAMES.find((name) =>
    SOFT_CONSTRAINTS.every((c) => getSoftWeight(doc, c.key) === PRESETS[name][c.key]),
  );

  return (
    <div className="relative z-10 h-full overflow-y-auto p-8 md:p-10" data-tour="constraints">
      <div className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Constraints
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          The rules every timetable must satisfy, plus the preferences it should try to honor.
        </p>
      </div>

      <div className="mx-auto max-w-3xl space-y-8">
        <section className={`${card} p-6`}>
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-500" />
            <h2 className="text-sm font-semibold">Hard rules (must satisfy)</h2>
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {HARD_CONSTRAINTS.map((def) => (
              <HardConstraintRow
                key={def.key}
                def={def}
                checked={getHardFlag(doc, def.key, true)}
                onToggle={(value) => ws.editProblem(setHardFlag(doc, def.key, value))}
              />
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Preferences</h2>
            </div>
            <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={advanced}
                onChange={(event) => setAdvanced(event.target.checked)}
              />
              Advanced weights
            </label>
          </div>

          <div className="flex w-max flex-wrap gap-1 rounded-xl border border-neutral-200 bg-neutral-100 p-1.5 dark:border-neutral-800 dark:bg-neutral-900">
            {PRESET_NAMES.map((name) => (
              <button
                key={name}
                onClick={() => applyPreset(name)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  activePreset === name
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {SOFT_CONSTRAINTS.map((def) => (
              <SoftConstraintCard
                key={def.key}
                def={def}
                weight={getSoftWeight(doc, def.key)}
                advanced={advanced}
                onWeightChange={(weight) => ws.editProblem(setSoftWeight(doc, def.key, weight))}
                impact={softImpact(def)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
