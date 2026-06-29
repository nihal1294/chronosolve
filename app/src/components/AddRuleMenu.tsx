import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { RULE_TEMPLATES, type RuleCategory, type RuleTemplate } from "../lib/rule-templates";

const CATEGORIES: RuleCategory[] = ["Time", "Teacher", "Group", "Subject", "Room", "Fairness"];

/** "Add rule" button opening a category-grouped picker over the 12 templates.
    Selecting one hands the template to the route, which opens its param form. */
export function AddRuleMenu({ onPick }: { onPick: (template: RuleTemplate) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Dismiss on an outside press or Escape (mirrors HelpMenu), so the dropdown
  // isn't left hanging open when the user clicks elsewhere.
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-neutral-700 dark:text-neutral-200 dark:hover:text-indigo-400"
      >
        <Plus size={16} /> Add rule
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 max-h-80 w-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          {CATEGORIES.map((category) => {
            const items = RULE_TEMPLATES.filter((t) => t.category === category);
            if (items.length === 0) return null;
            return (
              <div key={category}>
                <div className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  {category}
                </div>
                {items.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      onPick(template);
                      setOpen(false);
                    }}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
