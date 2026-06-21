import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SHORTCUTS } from "../lib/command-catalog";
import { useDialogFocus } from "../lib/use-dialog-focus";
import { Kbd } from "./Kbd";

// ⌘K toggles the palette itself, so the command center handles it directly
// rather than as a registry Command - it's the one binding listed statically.
const APP_ROWS: { label: string; keys: string[] }[] = [{ label: "Command Palette", keys: ["⌘", "K"] }];

interface ShortcutSheetProps {
  onClose: () => void;
}

/** Global-shortcuts cheat sheet. Lists EVERY shortcut from the canonical
    `SHORTCUTS` registry (plus ⌘K) regardless of whether the command is
    available right now - so this is the exhaustive reference, and it can't drift
    from the chips/bindings, which read the same registry. */
export function ShortcutSheet({ onClose }: ShortcutSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onDialogKeyDown = useDialogFocus(dialogRef);
  // The sheet has no focusable input to catch Escape (unlike the palette), so
  // close it from a window listener to match every other dialog's behaviour.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const groups: { title: string; rows: { label: string; keys: string[] }[] }[] = [
    { title: "Application", rows: APP_ROWS },
    { title: "Commands", rows: SHORTCUTS.map((spec) => ({ label: spec.label, keys: spec.keys })) },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onKeyDown={onDialogKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 duration-200 outline-none"
      >
        <div className="flex items-start justify-between mb-4">
          <h2 id="shortcuts-title" className="text-lg font-bold">
            Keyboard Shortcuts
          </h2>
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
