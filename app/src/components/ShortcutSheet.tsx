import { useEffect } from "react";
import { X } from "lucide-react";
import type { Command } from "../lib/use-app-commands";
import { Kbd } from "./Kbd";

// ⌘K toggles the palette itself, so the command center handles it directly
// rather than as a registry Command - it's the one binding listed statically.
const APP_ROWS: { label: string; keys: string[] }[] = [{ label: "Command Palette", keys: ["⌘", "K"] }];

interface ShortcutSheetProps {
  commands: Command[];
  onClose: () => void;
}

/** Global-shortcuts cheat sheet (Command Palette spec). Every binding except
    ⌘K is derived from the command registry, so adding a shortcut there shows
    up here automatically - the chips and the sheet can't drift apart. */
export function ShortcutSheet({ commands, onClose }: ShortcutSheetProps) {
  // The sheet has no focusable input to catch Escape (unlike the palette), so
  // close it from a window listener to match every other dialog's behaviour.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const bound = commands.filter((command) => command.shortcut && command.keys);
  const groups: { title: string; rows: { label: string; keys: string[] }[] }[] = [
    { title: "Application", rows: APP_ROWS },
    { title: "Commands", rows: bound.map((command) => ({ label: command.label, keys: command.keys! })) },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 dark:text-neutral-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="text-xs font-bold border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-3">
                {group.title}
              </div>
              <div className="space-y-2">
                {group.rows.map((row) => (
                  <div key={row.label} className="flex justify-between items-center text-sm">
                    <span className="text-neutral-500 dark:text-neutral-400">{row.label}</span>
                    <div className="flex gap-1">
                      {row.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
