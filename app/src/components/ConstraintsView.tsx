import { ShieldAlert, Zap, type LucideIcon } from "lucide-react";
import { setHardFlag, setSoftWeight, type ProblemDoc } from "../lib/problem-doc";
import { EmptyHint } from "./EmptyHint";

const HARD_FLAGS = [
  { key: "teacher_no_clash", label: "No teacher clashes", help: "A teacher holds one class at a time" },
  { key: "group_no_clash", label: "No group clashes", help: "A group attends one class at a time" },
  { key: "room_no_clash", label: "No room clashes", help: "A room hosts one class at a time" },
  { key: "respect_availability", label: "Respect availability", help: "Honor unavailable slots" },
  { key: "required_hours", label: "Schedule required hours", help: "Every subject gets its full hours" },
];

const SOFT_WEIGHTS = [
  { key: "minimize_student_gaps", label: "Minimize student gaps" },
  { key: "minimize_teacher_gaps", label: "Minimize teacher gaps" },
  { key: "spread_subjects", label: "Spread subjects across days" },
  { key: "teacher_time_preferences", label: "Honor teacher time preferences" },
  { key: "compact_schedules", label: "Compact teacher schedules" },
  { key: "avoid_consecutive_hours", label: "Avoid long consecutive stretches" },
  { key: "leave_early", label: "Let teachers leave early" },
  { key: "max_hours_per_day", label: "Cap teacher hours per day" },
  { key: "free_days", label: "Give teachers free days" },
  { key: "workload_balance", label: "Balance workload across days" },
];

const TONES = {
  red: {
    header: "bg-red-500/5 dark:bg-red-500/10",
    icon: "text-red-600 dark:text-red-400",
    pill: "border-red-200 bg-red-100 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400",
  },
  amber: {
    header: "bg-amber-500/5 dark:bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-500",
    pill: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400",
  },
};

const groupValues = (doc: ProblemDoc, group: "hard" | "soft"): Record<string, unknown> => {
  const constraints = doc.constraints;
  if (typeof constraints !== "object" || constraints === null) return {};
  const section = (constraints as Record<string, unknown>)[group];
  return typeof section === "object" && section !== null ? (section as Record<string, unknown>) : {};
};

const ROW_CLASS =
  "flex items-center gap-3 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50";

function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${
        on ? "bg-teal-500" : "bg-neutral-300 dark:bg-neutral-700"
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${on ? "right-1" : "left-1"}`}
      />
    </button>
  );
}

function ConstraintCard(props: {
  tone: keyof typeof TONES;
  icon: LucideIcon;
  title: string;
  pill: string;
  children: React.ReactNode;
}) {
  const tone = TONES[props.tone];
  const Icon = props.icon;
  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
      <header
        className={`px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between ${tone.header}`}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className={tone.icon} />
          <h3 className="font-semibold text-sm">{props.title}</h3>
        </div>
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${tone.pill}`}
        >
          {props.pill}
        </span>
      </header>
      <div className="p-4 space-y-3">{props.children}</div>
    </section>
  );
}

interface ConstraintsViewProps {
  doc: ProblemDoc | null;
  /** Structured edits write through the canonical doc (regenerates the YAML). */
  onEdit: (next: ProblemDoc) => void;
}

/** Hard toggles + soft penalty weights, per the design system's
    Constraint & Rules Engine spec (red "Must Satisfy" / amber
    "Minimize Penalty" cards). */
export function ConstraintsView({ doc, onEdit }: ConstraintsViewProps) {
  if (!doc) {
    return <EmptyHint label="No problem loaded — define one in the Problem Definition editor first." />;
  }
  const hard = groupValues(doc, "hard");
  const soft = groupValues(doc, "soft");
  const weightOf = (key: string): number => {
    const raw = soft[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  };

  return (
    <div className="flex-1 p-6 min-h-0 overflow-auto">
      <div className="max-w-3xl space-y-6">
        <ConstraintCard tone="red" icon={ShieldAlert} title="Hard Constraints" pill="Must Satisfy">
          {HARD_FLAGS.map((flag) => (
            <div key={flag.key} className={ROW_CLASS}>
              <div className="min-w-0">
                <div className="text-sm">{flag.label}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">{flag.help}</div>
              </div>
              <div className="ml-auto">
                <Toggle
                  on={hard[flag.key] !== false}
                  onChange={(next) => onEdit(setHardFlag(doc, flag.key, next))}
                />
              </div>
            </div>
          ))}
        </ConstraintCard>

        <ConstraintCard tone="amber" icon={Zap} title="Soft Constraints" pill="Minimize Penalty">
          {SOFT_WEIGHTS.map((pref) => (
            <div key={pref.key} className={ROW_CLASS}>
              <span className="text-sm">{pref.label}</span>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <span className="text-neutral-500 dark:text-neutral-400">Penalty Weight:</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={weightOf(pref.key)}
                  onChange={(event) => {
                    const next = Math.max(0, Math.min(100, Number(event.target.value) || 0));
                    onEdit(setSoftWeight(doc, pref.key, next));
                  }}
                  className="w-16 px-2 py-1 text-xs border rounded-md font-mono text-amber-600 dark:text-amber-400 bg-neutral-50 border-neutral-200 dark:bg-neutral-950 dark:border-neutral-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-neutral-500 dark:text-neutral-400 pl-1">
            Weight 0 disables a preference; higher weights matter more (max 100).
          </p>
        </ConstraintCard>
      </div>
    </div>
  );
}
