import { useEffect, useState } from "react";
import { CheckCircle2, PieChart } from "lucide-react";
import { penaltyShares, roomUtilization } from "../lib/analytics";
import { solverClient, type QualityReport, type SolveResult } from "../lib/solver-client";
import type { ProblemDoc } from "../lib/problem-doc";
import type { ProblemEntities } from "../lib/entities";

const CARD =
  "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm";
const BAR_COLORS = ["bg-amber-500", "bg-indigo-500", "bg-teal-500", "bg-red-500"];

interface SolveAnalyticsProps {
  doc: ProblemDoc;
  result: SolveResult;
  entities: ProblemEntities | null;
}

/** Score response keyed by the result it was computed for: a key mismatch at
    render time reads as "still scoring", so no effect has to reset state. */
interface ScoreState {
  forResult: SolveResult | null;
  report: QualityReport | null;
  error: string | null;
}

/** Post-solve analytics: room utilization KPI + the soft-constraint penalty
    breakdown from /score (the quality score + status already show as stat tiles). */
export function SolveAnalytics({ doc, result, entities }: SolveAnalyticsProps) {
  const [score, setScore] = useState<ScoreState>({ forResult: null, report: null, error: null });
  const live = score.forResult === result;
  const report = live ? score.report : null;
  const scoreError = live ? score.error : null;

  useEffect(() => {
    if (result.schedule.length === 0) return;
    let active = true; // a new result (or unmount) retires this fetch
    solverClient
      .score(doc, result.schedule)
      .then((scored) => active && setScore({ forResult: result, report: scored, error: null }))
      .catch((problem) => active && setScore({ forResult: result, report: null, error: String(problem) }));
    return () => {
      active = false;
    };
  }, [doc, result]);

  const utilization = entities
    ? roomUtilization(result.schedule, entities.rooms.length, entities.days.length, entities.slotsPerDay)
    : null;

  return (
    <div className="space-y-6">
      <div className={`flex flex-col gap-2 p-5 ${CARD}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            Room utilization
          </span>
          <PieChart size={16} className="text-indigo-500" />
        </div>
        <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
          {utilization !== null ? `${utilization.toFixed(1)}%` : "-"}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-500/10">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${utilization ?? 0}%` }} />
        </div>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Share of room-slots in use across the week.
        </span>
      </div>

      <div className={`${CARD} p-6`}>
        <h3 className="mb-6 text-sm font-semibold">Soft constraint penalty breakdown</h3>
        <Breakdown report={report} scoreError={scoreError} />
      </div>
    </div>
  );
}

function Breakdown({ report, scoreError }: { report: QualityReport | null; scoreError: string | null }) {
  if (scoreError) return <p className="text-xs text-red-600 dark:text-red-400">{scoreError}</p>;
  if (report === null)
    return <p className="text-xs text-neutral-500 dark:text-neutral-400">Scoring schedule...</p>;
  const shares = penaltyShares(report);
  if (shares.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400">
        <CheckCircle2 size={14} /> No soft-constraint penalties - a perfect score.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {shares.map((item, index) => (
        <div key={item.label} className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-neutral-500 dark:text-neutral-400">{item.label}</span>
            <span className="font-mono font-medium">{item.share}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className={`h-full rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`}
              style={{ width: `${item.share}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
