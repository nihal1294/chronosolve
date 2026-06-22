import { useEffect, useRef, useState } from "react";
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
import { HelpHintsLayer } from "../components/HelpHintsLayer";
import { ShortcutSheet } from "../components/ShortcutSheet";
import { WindowChrome } from "../components/WindowChrome";
import { WelcomeCard } from "../components/WelcomeCard";
import { useAppCommands } from "../lib/use-app-commands";
import { useMenuEvents } from "../lib/use-menu-events";
import { useEngineStatus, type EngineStatus } from "../lib/use-engine-status";
import { useOnboarding } from "../lib/onboarding/use-onboarding";
import { setHelpMode, toggleHelpMode } from "../lib/onboarding/help-mode";
import { loadOnboarding, markWelcomed, shouldShowWelcome } from "../lib/onboarding/onboarding-storage";
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
  const engineStatus = useEngineStatus();
  const engine = ENGINE[engineStatus];

  // Run needs a loaded problem AND a reachable engine - enabling it while the
  // solver is offline/connecting offers an action that's known to fail. Save
  // needs only text to save (an invalid-YAML draft has no parsed doc but is
  // still worth saving), matching the Data editor's own Save button.
  const canSolve = ws.doc !== null && engineStatus === "ready";
  const canSave = ws.yamlText.trim().length > 0;

  const { startTour } = useOnboarding();
  // Decide first-run during render (pure localStorage read) rather than via a
  // setState-in-effect, so the welcome card is correct on the first paint.
  const [showWelcome, setShowWelcome] = useState(() =>
    shouldShowWelcome(loadOnboarding(window.localStorage)),
  );

  const palette = useAppCommands({
    canSolve,
    busy: ws.busy,
    hasDoc: ws.doc !== null,
    canSave,
    solve: ws.solve,
    cancel: ws.cancel,
    loadTemplate: ws.loadTemplate,
    requestNewProblem: ws.requestNewProblem,
    // Open/Save work in the browser too now (file input + download), so the
    // commands are no longer Tauri-gated.
    fileActions: { onOpen: ws.openFile, onSave: ws.saveFile },
    navigate,
    startTour,
    toggleHints: toggleHelpMode,
  });

  // Native menu-bar items dispatch through the same command registry as the
  // palette; the state flags grey out items whose command isn't available now.
  useMenuEvents(palette.commands, {
    canSolve,
    busy: ws.busy,
    hasDoc: ws.doc !== null,
    canSave,
  });

  // First run shows the welcome card (the tour is no longer auto-started - the
  // card offers it as a choice). Load the bundled template into an empty
  // workspace first so whichever path the user picks - tour or self-guided
  // hints - lands on populated screens. bootedRef keeps this single-shot under
  // StrictMode's double-invoke.
  const bootedRef = useRef(false);
  // Holds the in-flight first-run template load so the tour can await it - on a
  // cold packaged launch it may still be reaching the sidecar. It resolves on
  // success OR failure, so awaiting it never blocks the tour forever.
  const bootTemplateRef = useRef<Promise<void> | undefined>(undefined);
  const [tourPending, setTourPending] = useState(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    if (showWelcome && ws.doc === null) bootTemplateRef.current = ws.loadTemplateIfEmpty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every welcome path persists "welcomed" so the card shows exactly once.
  const dismissWelcome = () => {
    markWelcomed(window.localStorage);
    setShowWelcome(false);
  };

  const border = isDark ? "border-neutral-800" : "border-neutral-200";

  return (
    <div
      className={`h-screen w-full flex flex-col overflow-hidden font-sans ${isDark ? "bg-[#0F172A]" : "bg-white"}`}
    >
      <WindowChrome
        onOpenPalette={palette.openPalette}
        isDark={isDark}
        onToggleTheme={() => setTheme(isDark ? "light" : "dark")}
        onStartTour={startTour}
        onOpenShortcuts={palette.openShortcuts}
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
              <div className="flex items-center gap-2" data-tour="engine-status">
                <div className={`w-2 h-2 rounded-full ${engine.dot}`} />
                <span className="hidden lg:inline">{engine.label}</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col relative z-10 overflow-hidden bg-neutral-50 dark:bg-neutral-950">
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)] bg-[size:32px_32px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]" />
          <Outlet />
        </div>
      </div>

      {palette.paletteOpen && <CommandPalette commands={palette.commands} onClose={palette.closePalette} />}
      {palette.shortcutsOpen && <ShortcutSheet onClose={palette.closeShortcuts} />}
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
      {showWelcome && (
        <WelcomeCard
          isDark={isDark}
          pending={tourPending}
          onTakeTour={async () => {
            // Wait for the first-run example to finish loading (or fail) so the
            // tour never walks onto empty "No problem loaded" screens.
            setTourPending(true);
            await bootTemplateRef.current;
            dismissWelcome();
            startTour();
          }}
          onLookAround={() => {
            dismissWelcome();
            setHelpMode(true);
          }}
          onClose={dismissWelcome}
        />
      )}
      <HelpHintsLayer />
      <Toaster theme={isDark ? "dark" : "light"} position="bottom-right" />
    </div>
  );
}
