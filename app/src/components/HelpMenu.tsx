import { useEffect, useRef, useState } from "react";
import { Compass, HelpCircle, Keyboard, Lightbulb } from "lucide-react";

interface HelpMenuProps {
  /** Whether ambient help hints are currently on (drives the toggle label). */
  helpMode: boolean;
  /** Theme-matched classes for the resting (closed) trigger button. */
  iconBtn: string;
  onStartTour: () => void;
  onToggleHints: () => void;
  onOpenShortcuts: () => void;
}

/** The top-bar Help entry point: one button that opens a small popover gathering
 *  every help affordance in a discoverable place - start the guided tour, toggle
 *  ambient help hints (also bound to Cmd-/), or open the keyboard-shortcuts
 *  sheet. Closes on outside click, Escape, or after running any item. The
 *  `data-tour="help"` anchor stays on the trigger so the registry's hint for it
 *  still resolves. */
export function HelpMenu({ helpMode, iconBtn, onStartTour, onToggleHints, onOpenShortcuts }: HelpMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close first, then act - so an action that opens a dialog isn't immediately
  // dismissed by this menu's own outside-click handler.
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const items = [
    { icon: Compass, label: "Start guided tour", hint: "", onSelect: run(onStartTour) },
    {
      icon: Lightbulb,
      label: helpMode ? "Hide help hints" : "Show help hints",
      hint: "⌘/",
      onSelect: run(onToggleHints),
    },
    { icon: Keyboard, label: "Keyboard shortcuts", hint: "", onSelect: run(onOpenShortcuts) },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        data-tour="help"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors ${
          open || helpMode ? "bg-indigo-500/20 text-indigo-400" : iconBtn
        }`}
      >
        <HelpCircle size={14} />
        Help
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[110] mt-2 w-60 origin-top-right rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150 dark:border-neutral-800 dark:bg-neutral-900 dark:ring-white/10"
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              onClick={item.onSelect}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              <item.icon size={15} className="shrink-0 text-indigo-500" />
              <span className="flex-1">{item.label}</span>
              {item.hint && (
                <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
                  {item.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
