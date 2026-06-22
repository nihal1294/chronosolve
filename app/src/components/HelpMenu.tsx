import { useEffect, useRef, useState } from "react";
import { Compass, HelpCircle, Keyboard, Lightbulb } from "lucide-react";
import { nextItemIndex } from "../lib/menu-nav";

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
 *  sheet. Opens as an ARIA menu: focus moves to the first item, arrow/Home/End
 *  move between items, Escape closes and returns focus to the trigger, Tab lets
 *  focus leave naturally, and an outside press closes. The `data-tour="help"`
 *  anchor stays on the trigger so the registry's hint for it still resolves. */
export function HelpMenu({ helpMode, iconBtn, onStartTour, onToggleHints, onOpenShortcuts }: HelpMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const selectable = itemRefs.current.map(() => true);
    const focusAt = (from: number, step: 1 | -1) =>
      itemRefs.current[nextItemIndex(selectable, from, step)]?.focus();
    focusAt(-1, 1);
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      const current = itemRefs.current.findIndex((el) => el === document.activeElement);
      switch (event.key) {
        case "Escape":
          setOpen(false);
          triggerRef.current?.focus();
          break;
        case "Tab":
          setOpen(false); // let focus leave the menu naturally
          break;
        case "ArrowDown":
          event.preventDefault();
          focusAt(current, 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          focusAt(current === -1 ? selectable.length : current, -1);
          break;
        case "Home":
          event.preventDefault();
          focusAt(-1, 1);
          break;
        case "End":
          event.preventDefault();
          focusAt(selectable.length, -1);
          break;
      }
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
        ref={triggerRef}
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
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              role="menuitem"
              onClick={item.onSelect}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-neutral-700 outline-none transition-colors hover:bg-neutral-100 focus:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
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
