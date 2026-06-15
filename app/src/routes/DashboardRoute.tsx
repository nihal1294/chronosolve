import { useNavigate } from "react-router";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Database,
  FilePlus2,
  FileText,
  FolderOpen,
  Loader2,
  Network,
  Play,
  UploadCloud,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { dashboardMetrics } from "../lib/dashboard-metrics";
import { useWorkspace } from "../providers/problem-doc-provider";

type Tone = "ready" | "pending" | "running" | "done" | "failed";

const TONE: Record<Tone, { chip: string; icon: LucideIcon; label: string }> = {
  ready: { chip: "text-teal-600 dark:text-teal-400 bg-teal-500/10", icon: CheckCircle2, label: "Ready" },
  done: { chip: "text-teal-600 dark:text-teal-400 bg-teal-500/10", icon: CheckCircle2, label: "Solved" },
  running: { chip: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10", icon: Loader2, label: "Solving" },
  pending: {
    chip: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    icon: CircleDashed,
    label: "Pending",
  },
  failed: { chip: "text-red-600 dark:text-red-400 bg-red-500/10", icon: XCircle, label: "Infeasible" },
};

const card =
  "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm";

function StatusChip({ tone }: { tone: Tone }) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${t.chip}`}
    >
      <t.icon size={14} className={tone === "running" ? "animate-spin" : ""} />
      {t.label}
    </span>
  );
}

export function DashboardRoute() {
  const navigate = useNavigate();
  const ws = useWorkspace();
  const m = dashboardMetrics(ws.entities, ws.result);

  if (!ws.doc) {
    return (
      <div
        className="relative z-10 h-full overflow-y-auto flex items-center justify-center p-8"
        data-tour="dashboard"
      >
        <div className="max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
            <CalendarDays size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Build your first timetable
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            Start from a worked example, or bring your own courses, instructors, rooms, and groups.
            ChronoSolve finds a conflict-free schedule that respects your constraints.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              onClick={ws.loadTemplate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              <FileText size={16} />
              Load example template
            </button>
            <button
              onClick={ws.openFile}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <FolderOpen size={16} />
              Open file (YAML / JSON)
            </button>
            <button
              onClick={() => navigate("/data?import=1")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <UploadCloud size={16} />
              Import CSV
            </button>
          </div>
          {(ws.templateError || ws.fileError) && (
            <p className="mt-4 text-xs text-red-500">{ws.templateError ?? ws.fileError}</p>
          )}
        </div>
      </div>
    );
  }

  const outputTone: Tone = ws.busy
    ? "running"
    : m.solveStatus
      ? m.hardConstraintsMet
        ? "done"
        : "failed"
      : "pending";
  const outputSub = ws.busy
    ? "Optimizing…"
    : m.solveStatus
      ? m.hardConstraintsMet
        ? `Quality ${m.qualityScore ?? "—"} / 100`
        : "No feasible solution"
      : "Ready to run";

  const steps = [
    {
      to: "/data",
      icon: Database,
      title: "1 · Data",
      sub: m.hasData ? `${m.courses} courses · ${m.rooms} rooms` : "No data yet",
      tone: (m.hasData ? "ready" : "pending") as Tone,
    },
    {
      to: "/constraints",
      icon: Network,
      title: "2 · Constraints",
      sub: "Hard rules + soft priorities",
      tone: "ready" as Tone,
    },
    { to: "/solver", icon: CalendarDays, title: "3 · Solve", sub: outputSub, tone: outputTone },
  ];

  const cta = ws.busy
    ? { label: "View solver progress", icon: Loader2, run: () => navigate("/solver") }
    : m.hardConstraintsMet
      ? { label: "View timetable", icon: CalendarDays, run: () => navigate("/timetable") }
      : {
          label: "Run solver",
          icon: Play,
          run: () => {
            ws.solve();
            navigate("/solver");
          },
        };

  const stats = [
    { label: "Courses", value: m.courses },
    { label: "Instructors", value: m.instructors },
    { label: "Rooms", value: m.rooms },
    { label: "Student groups", value: m.groups },
  ];

  return (
    <div className="relative z-10 h-full overflow-y-auto p-8 md:p-10" data-tour="dashboard">
      <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {m.weeklyHours} teaching hours/week across {m.courses} courses. Follow the pipeline to your
            schedule.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={ws.requestNewProblem}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <FilePlus2 size={16} />
            New problem
          </button>
          <button
            onClick={cta.run}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <cta.icon size={16} className={ws.busy ? "animate-spin" : ""} />
            {cta.label}
          </button>
        </div>
      </div>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Scheduling pipeline
      </h2>
      <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <button
            key={step.to}
            onClick={() => navigate(step.to)}
            className={`group flex flex-col items-start p-5 text-left transition-colors hover:border-neutral-300 dark:hover:border-neutral-700 ${card}`}
          >
            <div className="mb-4 flex w-full items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 transition-transform group-hover:scale-110 dark:bg-neutral-800 dark:text-neutral-300">
                <step.icon size={20} />
              </span>
              <ArrowRight
                size={16}
                className="text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </div>
            <div className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{step.title}</div>
            <div className="mb-4 text-xs text-neutral-500 dark:text-neutral-400">{step.sub}</div>
            <div className="mt-auto">
              <StatusChip tone={step.tone} />
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`p-4 ${card}`}>
            <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stat.value}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
