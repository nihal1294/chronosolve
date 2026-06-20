import { useEffect } from "react";
import { CalendarDays, Database, Network, Play, X, type LucideIcon } from "lucide-react";

interface Step {
  icon: LucideIcon;
  title: string;
  detail: string;
}

const STEPS: Step[] = [
  {
    icon: Database,
    title: "Add your data",
    detail:
      "Enter courses, instructors, rooms, and student groups on the Data tab — or load the worked example, open a saved file, or import CSVs.",
  },
  {
    icon: Network,
    title: "Set the rules",
    detail:
      "On Constraints, keep the hard rules that must always hold, then dial how strongly to honour each soft preference (or pick a preset).",
  },
  {
    icon: Play,
    title: "Run the scheduler",
    detail:
      "From the Scheduler tab (or ⌘↵), ChronoSolve searches for a conflict-free timetable and streams its progress.",
  },
  {
    icon: CalendarDays,
    title: "View & export",
    detail:
      "Explore the result by class, teacher, or room on Timetable, pin the sessions you like, and export it as CSV.",
  },
];

/** In-app "how to use" guide (Help ▸ How to Use). The four-step journey the
    whole app is built around, so non-technical users never need the README. */
export function HowToUse({ onClose }: { onClose: () => void }) {
  // No focusable input to catch Escape, so close from a window listener - the
  // same pattern every other dialog uses.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold">How to use ChronoSolve</h2>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 dark:text-neutral-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
          Turn your courses, people, and rooms into a conflict-free timetable in four steps.
        </p>
        <ol className="space-y-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="flex gap-3">
                <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400">
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {index + 1}. {step.title}
                  </div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{step.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
          Tip: press <span className="font-mono">⌘K</span> any time to jump to a command, or open Help ▸
          Keyboard Shortcuts for the full list.
        </p>
      </div>
    </div>
  );
}
