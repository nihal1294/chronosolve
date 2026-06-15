import { useNavigate } from "react-router";
import { CalendarDays, Database, Play, RotateCcw, Square } from "lucide-react";
import { useWorkspace } from "../providers/problem-doc-provider";
import { SolverStateCard, type SolverPhase } from "../components/SolverStateCard";

const card =
  "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700";

const SUMMARY: Record<SolverPhase, string> = {
  idle: "Run the solver to generate a conflict-free schedule.",
  solving: "Optimizing - the best schedule found so far improves as it runs.",
  optimal: "Optimal schedule found: no better arrangement exists for these constraints.",
  feasible: "Feasible schedule found within the time limit.",
  infeasible: "No feasible schedule. Relax a hard constraint or fix the data, then run again.",
  timeout: "Stopped at the time limit with the best schedule found so far.",
  error: "The solver could not complete.",
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
            Add courses, instructors, rooms, and groups before running the solver.
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

  const stats =
    result && feasible
      ? [
          { label: "Quality", value: result.quality_score !== null ? `${result.quality_score} / 100` : "-" },
          { label: "Status", value: result.status },
          { label: "Solve time", value: `${result.solve_time_seconds.toFixed(2)}s` },
          { label: "Sessions", value: String(result.schedule.length) },
        ]
      : null;

  return (
    <div className="relative z-10 h-full overflow-y-auto p-8 md:p-10" data-tour="solver">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Solver</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Run the CP-SAT engine and watch it converge. Results feed the timetable.
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
            {result ? "Run again" : "Run solver"}
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

        {stats && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((stat) => (
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
