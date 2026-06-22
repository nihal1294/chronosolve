import { useEffect } from "react";
import { Command as CmdIcon, HelpCircle, Moon, Search, Sun } from "lucide-react";
import { setHelpMode, toggleHelpMode, useHelpMode } from "../lib/onboarding/help-mode";
import { HelpMenu } from "./HelpMenu";

interface WindowChromeProps {
  /** Opens the shell-owned command palette (single source of truth for Cmd+K). */
  onOpenPalette: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  /** Launch (or replay) the guided tour from the Help menu. */
  onStartTour: () => void;
  /** Open the keyboard-shortcuts sheet from the Help menu. */
  onOpenShortcuts: () => void;
}

/** In-window top bar beneath the native OS title bar (EX-3: native window
    decorations are kept, the decorative traffic lights are dropped). Provides
    the centered Cmd+K search pill, a theme toggle, and the Help menu - whose
    "Show help hints" item (and Cmd+/) sets body.help-mode-active to light up the
    HelpHintsLayer. Esc clears Help Mode. */
export function WindowChrome({
  onOpenPalette,
  isDark,
  onToggleTheme,
  onStartTour,
  onOpenShortcuts,
}: WindowChromeProps) {
  const helpMode = useHelpMode();

  // Cmd-/ to toggle hints is owned by the command system (toggle-help-hints):
  // the JS dispatcher in the browser, the native menu accelerator on desktop.
  // Esc-to-clear lives here because it is not a menu accelerator.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHelpMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const bar = isDark ? "bg-neutral-950 border-neutral-800" : "bg-neutral-100 border-neutral-200";
  const pill = isDark
    ? "bg-neutral-900 border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 text-neutral-400"
    : "bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-500";
  const iconBtn = isDark
    ? "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
    : "text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800";

  return (
    <>
      <div
        className={`h-10 shrink-0 w-full relative z-50 flex items-center justify-between gap-4 px-4 border-b select-none ${bar}`}
      >
        <div className="w-1/4" />
        <div className="flex-1 flex justify-center">
          <button
            onClick={onOpenPalette}
            data-tour="command-palette"
            className={`flex items-center justify-between w-64 max-w-full px-3 py-1 text-xs rounded-md border transition-colors ${pill}`}
          >
            <span className="flex items-center gap-2">
              <Search size={12} />
              Search or jump to...
            </span>
            <span className="flex items-center gap-0.5 opacity-60">
              <CmdIcon size={10} />K
            </span>
          </button>
        </div>
        <div className="w-1/4 flex items-center justify-end gap-1">
          <button
            onClick={onToggleTheme}
            title="Toggle theme"
            aria-label="Toggle theme"
            data-tour="theme-toggle"
            className={`p-1.5 rounded transition-colors ${iconBtn}`}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <HelpMenu
            helpMode={helpMode}
            iconBtn={iconBtn}
            onStartTour={onStartTour}
            onToggleHints={toggleHelpMode}
            onOpenShortcuts={onOpenShortcuts}
          />
        </div>
      </div>

      {helpMode && (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl shadow-2xl border border-indigo-500/50 animate-in slide-in-from-bottom-4">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <HelpCircle size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold">Help Mode Active</div>
            <div className="text-xs text-indigo-100 mt-0.5">
              Hover over elements with a blue dot for context.
            </div>
          </div>
          <button
            onClick={() => setHelpMode(false)}
            className="ml-2 px-2 py-1 text-xs font-medium bg-black/20 hover:bg-black/40 rounded transition-colors"
          >
            Disable (Esc)
          </button>
        </div>
      )}
    </>
  );
}
