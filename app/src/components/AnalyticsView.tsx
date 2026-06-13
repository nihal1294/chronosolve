import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { BarChart3, CheckCircle2, PieChart, TrendingUp } from "lucide-react";
import { penaltyShares, roomUtilization } from "../lib/analytics";
import { solverClient, type QualityReport, type SolveResult } from "../lib/solver-client";
import type { ProblemDoc } from "../lib/problem-doc";
import type { ProblemEntities } from "../lib/entities";
import { EmptyHint } from "./EmptyHint";
import { ExportCenter } from "./ExportCenter";

const BAR_COLORS = ["bg-amber-500", "bg-indigo-500", "bg-teal-500", "bg-red-500"];
const CARD = "rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900";

interface AnalyticsViewProps {
  doc: ProblemDoc | null;
  result: SolveResult | null;
  entities: ProblemEntities | null;
  /** Final CP-SAT objective of the displayed solve (total weighted penalty). */
  objective: number | null;
  /** Final objective of the previous completed solve, for the delta caption. */
  lastObjective: number | null;
}

/** Score response keyed by the result it was computed for: a key mismatch at
    render time reads as "still scoring", so no effect has to reset state. */
interface ScoreState {
  forResult: SolveResult | null;
  report: QualityReport | null;
  error: string | null;
}

/** Post-solve KPI dashboard, penalty breakdown, and export center per the
    design system's MetricsReportingTab ("Analytics & Export"). */
export function AnalyticsView({ doc, result, entities, objective, lastObjective }: AnalyticsViewProps) {
  const [score, setScore] = useState<ScoreState>({ forResult: null, report: null, error: null });
  const live = score.forResult === result;
  const report = live ? score.report : null;
  const scoreError = live ? score.error : null;

  useEffect(() => {
    if (!doc || !result || result.schedule.length === 0) return;
    let active = true; // result identity changes (or unmount) retires this fetch
    solverClient
      .score(doc, result.schedule)
      .then((scored) => active && setScore({ forResult: result, report: scored, error: null }))
      .catch((problem) => active && setScore({ forResult: result, report: null, error: String(problem) }));
    return () => {
      active = false;
    };
  }, [doc, result]);

  if (!result || result.schedule.length === 0) {
    return <EmptyHint label="Run a solve first - analytics describe the latest schedule." />;
  }

  const utilization = entities
    ? roomUtilization(result.schedule, entities.rooms.length, entities.days.length, entities.slotsPerDay)
    : null;

  return (
    <div className="flex-1 p-6 min-h-0 overflow-auto">
      <div className="max-w-5xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard title="Schedule Quality" icon={TrendingUp} iconClass="text-teal-500">
            <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
              {result.quality_score !== null ? `${result.quality_score.toFixed(1)}%` : "-"}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Based on soft constraint satisfaction
            </div>
          </KpiCard>
          <KpiCard title="Room Utilization" icon={PieChart} iconClass="text-indigo-500">
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {utilization !== null ? `${utilization.toFixed(1)}%` : "-"}
            </div>
            <div className="w-full h-1.5 bg-indigo-500/10 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${utilization ?? 0}%` }} />
            </div>
          </KpiCard>
          <KpiCard title="Penalty Points" icon={BarChart3} iconClass="text-amber-500">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-500">{objective ?? "-"}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              {penaltyCaption(objective, lastObjective)}
            </div>
          </KpiCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className={`${CARD} p-6`}>
            <h3 className="text-sm font-semibold mb-6">Soft Constraint Penalty Breakdown</h3>
            <Breakdown report={report} scoreError={scoreError} />
          </div>
          <ExportCenter schedule={result.schedule} />
        </div>
      </div>
    </div>
  );
}

function penaltyCaption(objective: number | null, lastObjective: number | null): string {
  if (objective === null || lastObjective === null) return "Total weighted soft-constraint penalty";
  const delta = objective - lastObjective;
  return `${delta >= 0 ? "+" : ""}${delta} from previous baseline`;
}

interface KpiCardProps {
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  children: ReactNode;
}

function KpiCard({ title, icon: Icon, iconClass, children }: KpiCardProps) {
  return (
    <div className={`${CARD} p-5 flex flex-col gap-2`}>
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">{title}</span>
        <Icon size={16} className={iconClass} />
      </div>
      {children}
    </div>
  );
}

function Breakdown({ report, scoreError }: { report: QualityReport | null; scoreError: string | null }) {
  if (scoreError) return <p className="text-xs text-red-600 dark:text-red-400">{scoreError}</p>;
  if (report === null)
    return <p className="text-xs text-neutral-500 dark:text-neutral-400">Scoring schedule…</p>;
  const shares = penaltyShares(report);
  if (shares.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 font-medium">
        <CheckCircle2 size={14} /> No soft-constraint penalties - perfect score.
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
          <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden flex">
            <div
              className={`h-full ${BAR_COLORS[index % BAR_COLORS.length]} rounded-full`}
              style={{ width: `${item.share}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
