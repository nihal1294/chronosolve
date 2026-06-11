import { Loader2, Moon, Play, Sun } from "lucide-react";

export type WorkspaceView = "editor" | "constraints" | "table" | "timeline";

interface ToolbarProps {
  view: WorkspaceView;
  onView: (view: "table" | "timeline") => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  busy: boolean;
  canSolve: boolean;
  onSolve: () => void;
}

const pillClass = (active: boolean): string =>
  `text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
    active
      ? "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
      : "border border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
  }`;

/** Workspace toolbar: view pills on the left, theme toggle + Solve on the right. */
export function Toolbar({ view, onView, theme, onToggleTheme, busy, canSolve, onSolve }: ToolbarProps) {
  return (
    <div className="h-12 shrink-0 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-4 justify-between bg-black/5 dark:bg-white/5">
      <div className="flex gap-2">
        <button className={pillClass(view === "timeline")} onClick={() => onView("timeline")}>
          Timeline View
        </button>
        <button className={pillClass(view === "table")} onClick={() => onView("table")}>
          Table View
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          title="Toggle Theme"
          className="p-2 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 transition-colors"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={onSolve}
          disabled={busy || !canSolve}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:hover:bg-indigo-600"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-white" />}
          {busy ? "Solving..." : "Solve"}
        </button>
      </div>
    </div>
  );
}
