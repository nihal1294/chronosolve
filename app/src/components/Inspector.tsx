import { Calendar, Lock } from "lucide-react";
import { SolverStateCard, type SolverPhase } from "./SolverStateCard";

/** Pre-resolved details for the selected session block. */
export interface SessionDetails {
  code: string;
  name: string;
  day: string;
  slotLabel: string;
  /** Pre-assigned sessions render the indigo "locked" language. */
  locked: boolean;
  rows: [label: string, value: string][];
}

interface InspectorProps {
  phase: SolverPhase;
  elapsed: number;
  summary: string;
  unresolved: string[];
  /** Quality/time metric tiles, shown after a successful solve. */
  metrics: [label: string, value: string][] | null;
  session: SessionDetails | null;
}

function MetricTiles({ metrics }: { metrics: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {metrics.map(([label, value]) => (
        <div
          key={label}
          className="p-3 rounded-lg bg-neutral-50 dark:bg-black/20 border border-neutral-100 dark:border-neutral-800"
        >
          <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 dark:text-neutral-400">
            {label}
          </div>
          <div className="font-mono mt-1 text-sm">{value}</div>
        </div>
      ))}
    </div>
  );
}

function SessionPanel({ session }: { session: SessionDetails }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-bold leading-tight">{session.name}</div>
        <div className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">{session.code}</div>
      </div>

      {/* Chip hue mirrors the timeline's state language: teal placed, indigo locked. */}
      <div
        className={`p-2.5 rounded-lg border ${
          session.locked ? "border-indigo-500/30 bg-indigo-500/10" : "border-teal-500/30 bg-teal-500/10"
        }`}
      >
        <div
          className={`text-[10px] font-medium flex items-center gap-1 ${
            session.locked ? "text-indigo-600 dark:text-indigo-400" : "text-teal-600 dark:text-teal-400"
          }`}
        >
          {session.locked ? <Lock size={10} /> : <Calendar size={10} />}
          {session.locked ? "Locked" : "Scheduled"}
        </div>
        <div className="text-xs mt-1">
          {session.day} • {session.slotLabel}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 dark:text-neutral-400">
          Properties
        </div>
        {session.rows.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-3 text-xs pb-1 border-b border-neutral-200 dark:border-neutral-800"
          >
            <span className="text-neutral-500 dark:text-neutral-400 shrink-0">{label}</span>
            <span className="text-right truncate">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Right context pane: solver feedback plus details for the selected session. */
export function Inspector({ phase, elapsed, summary, unresolved, metrics, session }: InspectorProps) {
  return (
    <aside className="w-72 shrink-0 flex flex-col border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 overflow-y-auto">
      <div className="h-12 shrink-0 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-4">
        <span className="text-sm font-bold">Inspector</span>
      </div>
      <div className="p-4 space-y-4">
        <SolverStateCard phase={phase} elapsed={elapsed} summary={summary} unresolved={unresolved} />
        {metrics && <MetricTiles metrics={metrics} />}
        {session ? (
          <SessionPanel session={session} />
        ) : (
          metrics && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Select a session block in the timeline to inspect it.
            </p>
          )
        )}
      </div>
    </aside>
  );
}
