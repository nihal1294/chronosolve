import { NavLink, Outlet, useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import {
  Activity,
  CalendarDays,
  Database,
  LayoutTemplate,
  Network,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";
import { CommandPalette } from "../components/CommandPalette";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { HelpSpotlight } from "../components/HelpSpotlight";
import { ShortcutSheet } from "../components/ShortcutSheet";
import { WindowChrome } from "../components/WindowChrome";
import { useAppCommands } from "../lib/use-app-commands";
import { useEngineStatus, type EngineStatus } from "../lib/use-engine-status";
import { useWorkspace } from "../providers/problem-doc-provider";

// Journey order (Dashboard -> get data in -> set rules -> solve -> see output),
// with plain labels - the v26 "ETL Manager / Engine / Monitor / Viewer" naming
// is engineer jargon for our non-technical scheduler.
const WORKSPACE: { to: string; end?: boolean; icon: LucideIcon; label: string }[] = [
  { to: "/", end: true, icon: LayoutTemplate, label: "Dashboard" },
  { to: "/data", icon: Database, label: "Data" },
  { to: "/constraints", icon: Network, label: "Constraints" },
  { to: "/solver", icon: Activity, label: "Scheduler" },
  { to: "/timetable", icon: CalendarDays, label: "Timetable" },
];

const ENGINE: Record<EngineStatus, { dot: string; label: string }> = {
  ready: { dot: "bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.8)]", label: "Ready" },
  connecting: {
    dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)] animate-pulse",
    label: "Connecting…",
  },
  offline: { dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]", label: "Offline" },
};

/** A link's classes; collapses to a centered icon below the lg breakpoint so a
    narrow window keeps room for the main pane (the shell-level half of bug #8). */
function navClass(isActive: boolean): string {
  const offState = "text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-100";
  return `flex items-center gap-3 px-0 lg:px-3 py-2 text-sm rounded-lg transition-colors justify-center lg:justify-start ${
    isActive ? "bg-indigo-500/10 text-indigo-400 font-medium" : offState
  }`;
}

export function ApplicationShell() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const navigate = useNavigate();
  const ws = useWorkspace();
  const engine = ENGINE[useEngineStatus()];

  const palette = useAppCommands({
    canSolve: ws.doc !== null,
    busy: ws.busy,
    hasDoc: ws.doc !== null,
    solve: ws.solve,
    cancel: ws.cancel,
    loadTemplate: ws.loadTemplate,
    requestNewProblem: ws.requestNewProblem,
    // Open/Save work in the browser too now (file input + download), so the
    // commands are no longer Tauri-gated.
    fileActions: { onOpen: ws.openFile, onSave: ws.saveFile },
    navigate,
  });

  const border = isDark ? "border-neutral-800" : "border-neutral-200";

  return (
    <div
      className={`h-screen w-full flex flex-col overflow-hidden font-sans ${isDark ? "bg-[#0F172A]" : "bg-white"}`}
    >
      <WindowChrome
        onOpenPalette={palette.openPalette}
        isDark={isDark}
        onToggleTheme={() => setTheme(isDark ? "light" : "dark")}
      />

      <div className="flex-1 flex overflow-hidden">
        <aside
          data-tour="sidebar"
          className={`w-16 lg:w-64 shrink-0 flex flex-col border-r relative z-20 ${border} ${isDark ? "bg-neutral-950" : "bg-neutral-100"}`}
        >
          <div className={`h-14 shrink-0 flex items-center px-4 border-b ${border}`}>
            <div className="flex items-center gap-2">
              <BrandLogo variant="app-icon" size={24} animated={false} theme={isDark ? "dark" : "light"} />
              <span
                className={`font-semibold tracking-tight hidden lg:block ${isDark ? "text-neutral-100" : "text-neutral-900"}`}
              >
                ChronoSolve
              </span>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {WORKSPACE.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={item.label}
                className={({ isActive }) => navClass(isActive)}
              >
                <item.icon size={16} />
                <span className="hidden lg:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className={`border-t ${border}`}>
            <div className="px-3 pt-3">
              <NavLink to="/settings" title="Settings" className={({ isActive }) => navClass(isActive)}>
                <Settings size={16} />
                <span className="hidden lg:inline">Settings</span>
              </NavLink>
            </div>
            <div className="p-4 text-xs flex items-center text-neutral-600 dark:text-neutral-400">
              <HelpSpotlight
                title="Scheduler"
                content="Live status of the local scheduling service this app runs on."
                position="top"
              >
                <div className="flex items-center gap-2" data-tour="engine-status">
                  <div className={`w-2 h-2 rounded-full ${engine.dot}`} />
                  <span className="hidden lg:inline">{engine.label}</span>
                </div>
              </HelpSpotlight>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col relative z-10 overflow-hidden bg-neutral-50 dark:bg-neutral-950">
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]" />
          <Outlet />
        </div>
      </div>

      {palette.paletteOpen && <CommandPalette commands={palette.commands} onClose={palette.closePalette} />}
      {palette.shortcutsOpen && (
        <ShortcutSheet commands={palette.commands} onClose={palette.closeShortcuts} />
      )}
      {ws.pendingNewProblem && (
        <ConfirmDialog
          title="Start a new problem?"
          message="This clears the current data, constraints, and any solved timetable. Save your work first if you want to keep it."
          confirmLabel="Start new"
          destructive
          onConfirm={() => {
            ws.newProblem();
            navigate("/");
          }}
          onClose={ws.cancelNewProblem}
        />
      )}
      <Toaster theme={isDark ? "dark" : "light"} position="bottom-right" />
    </div>
  );
}
