import { useNavigate } from "react-router";
import { CalendarDays, Database, Play, RotateCcw, Square } from "lucide-react";
import { useWorkspace } from "../providers/problem-doc-provider";
import { SolverStateCard, type SolverPhase } from "../components/SolverStateCard";
import { SolveAnalytics } from "../components/SolveAnalytics";
import { ExportCard } from "../components/ExportCard";

const card =
  "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700";

const SUMMARY: Record<SolverPhase, string> = {
  idle: "Run the scheduler to generate a conflict-free timetable.",
  solving: "Scheduling - the best timetable found so far improves as it runs.",
  optimal: "Optimal timetable found: no better arrangement exists for these constraints.",
  feasible: "Valid timetable found within the time limit.",
  infeasible: "No valid timetable. Relax a constraint or fix the data, then run again.",
  timeout: "Stopped at the time limit with the best timetable found so far.",
  error: "The scheduler could not complete.",
};

export function SolverMonitorRoute() {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const result = ws.result;

  if (!ws.doc) {
    return (
      <div className="relative z-10 flex h-full items-center justify-center p-8" data-tour="solver">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
            <Database size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            No problem loaded
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            Add courses, instructors, rooms, and groups before running the scheduler.
          </p>
          <button onClick={() => navigate("/data")} className={`mt-6 ${primary}`}>
            Go to Data
          </button>
        </div>
      </div>
    );
  }

  const phase: SolverPhase = ws.solveError ? "error" : ws.busy ? "solving" : result ? result.status : "idle";
  const elapsed = ws.progress?.elapsed ?? result?.solve_time_seconds ?? 0;
  const feasible = result !== null && (result.status === "optimal" || result.status === "feasible");
  const summary = phase === "error" ? (ws.solveError ?? SUMMARY.error) : SUMMARY[phase];

  return (
    <div className="relative z-10 h-full overflow-y-auto p-8 md:p-10" data-tour="solver">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Scheduler
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Run the scheduler and watch it find the best conflict-free timetable. Results feed the Timetable
            view.
          </p>
        </div>
        {ws.busy ? (
          <button
            onClick={ws.cancel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Square size={16} />
            Halt
          </button>
        ) : (
          <button onClick={ws.solve} className={primary}>
            {result ? <RotateCcw size={16} /> : <Play size={16} />}
            {result ? "Run again" : "Run scheduler"}
          </button>
        )}
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <SolverStateCard
          phase={phase}
          elapsed={elapsed}
          summary={summary}
          unresolved={result?.unresolved ?? []}
        />

        {ws.busy && (
          <div className={`grid grid-cols-2 gap-4 p-5 ${card}`}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Best objective
              </div>
              <div className="mt-1 font-mono text-lg">
                {(ws.progress?.objective ?? ws.lastObjective)?.toLocaleString() ?? "-"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Solutions found
              </div>
              <div className="mt-1 font-mono text-lg">{ws.progress?.solution_count ?? 0}</div>
            </div>
          </div>
        )}

        {result && feasible && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  label: "Quality",
                  value: result.quality_score !== null ? `${result.quality_score} / 100` : "-",
                },
                { label: "Status", value: result.status },
                { label: "Time taken", value: `${result.solve_time_seconds.toFixed(2)}s` },
                { label: "Sessions", value: String(result.schedule.length) },
              ].map((stat) => (
                <div key={stat.label} className={`p-4 ${card}`}>
                  <div className="text-2xl font-bold capitalize text-neutral-900 dark:text-neutral-100">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <SolveAnalytics doc={ws.doc} result={result} entities={ws.entities} />
            <ExportCard schedule={result.schedule} />

            <button onClick={() => navigate("/timetable")} className={`w-full ${primary}`}>
              <CalendarDays size={16} />
              View timetable
            </button>
          </>
        )}
      </div>
    </div>
  );
}
