import { AlertTriangle, CheckCircle2, Clock, Cpu, Loader2, type LucideIcon } from "lucide-react";

export type SolverPhase = "idle" | "solving" | "optimal" | "feasible" | "infeasible" | "timeout" | "error";

interface SolverStateCardProps {
  phase: SolverPhase;
  /** Seconds elapsed, shown as a mono timer while solving. */
  elapsed: number;
  /** One-line human summary for the current phase. */
  summary: string;
  /** Subjects the solver could not place (infeasible diagnostics). */
  unresolved: string[];
}

interface Style {
  card: string;
  chip: string;
  title: string;
  body: string;
  icon: LucideIcon;
  heading: string;
}

const NEUTRAL_CARD = "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800";
const NEUTRAL_TEXT = "text-neutral-500 dark:text-neutral-400";

/* Class strings stay fully literal so Tailwind's scanner generates them. */
const TEAL: Omit<Style, "icon" | "heading"> = {
  card: "bg-teal-50 border-teal-100 dark:bg-teal-950/20 dark:border-teal-900/50",
  chip: "bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded-full",
  title: "text-teal-800 dark:text-teal-200",
  body: "text-teal-700 dark:text-teal-300",
};
const RED: Omit<Style, "icon" | "heading"> = {
  card: "bg-red-50 border-red-100 dark:bg-red-950/20 dark:border-red-900/50",
  chip: "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg",
  title: "text-red-800 dark:text-red-200",
  body: "text-red-700 dark:text-red-300",
};
const AMBER: Omit<Style, "icon" | "heading"> = {
  card: "bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/50",
  chip: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg",
  title: "text-amber-800 dark:text-amber-200",
  body: "text-amber-700 dark:text-amber-300",
};

const STYLES: Record<SolverPhase, Style> = {
  idle: {
    card: NEUTRAL_CARD,
    chip: "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg",
    title: "",
    body: NEUTRAL_TEXT,
    icon: Cpu,
    heading: "Ready to Schedule",
  },
  solving: {
    card: NEUTRAL_CARD,
    chip: "text-indigo-500",
    title: "",
    body: NEUTRAL_TEXT,
    icon: Loader2,
    heading: "Building Timetable...",
  },
  optimal: { ...TEAL, icon: CheckCircle2, heading: "Optimal Timetable Found" },
  feasible: { ...TEAL, icon: CheckCircle2, heading: "Valid Timetable Found" },
  infeasible: { ...RED, icon: AlertTriangle, heading: "No Valid Timetable" },
  timeout: { ...AMBER, icon: Clock, heading: "Time Limit Reached" },
  error: { ...RED, icon: AlertTriangle, heading: "Scheduler Error" },
};

/** Solver feedback card, following the design system's Solver States patterns. */
export function SolverStateCard({ phase, elapsed, summary, unresolved }: SolverStateCardProps) {
  const style = STYLES[phase];
  const Icon = style.icon;

  return (
    <section className={`p-4 rounded-xl border shadow-sm space-y-3 relative overflow-hidden ${style.card}`}>
      {phase === "solving" && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500/20">
          <div className="h-full w-2/3 bg-indigo-500 animate-pulse" />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {phase === "solving" ? (
            <Icon size={18} className={`shrink-0 animate-spin ${style.chip}`} />
          ) : (
            <span className={`p-1.5 shrink-0 ${style.chip}`}>
              <Icon size={16} />
            </span>
          )}
          <h3 className={`text-sm font-semibold truncate ${style.title}`}>{style.heading}</h3>
        </div>
        {phase === "solving" && (
          <span className={`text-xs font-mono shrink-0 ${NEUTRAL_TEXT}`}>{elapsed.toFixed(1)}s</span>
        )}
      </div>

      <p className={`text-xs leading-relaxed break-words ${style.body}`}>{summary}</p>

      {unresolved.length > 0 && (
        <ul className={`font-mono text-[11px] space-y-0.5 ${style.body}`}>
          {unresolved.map((subject) => (
            <li key={subject}>• {subject}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
