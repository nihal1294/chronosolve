import { Info } from "lucide-react";

interface EditorViewProps {
  yamlText: string;
  onChange: (text: string) => void;
  /** Editor-scoped notice: YAML parse hint or template-load failure. */
  hint: string | null;
  onLoadTemplate: () => void;
}

/** Center workspace: the YAML problem definition editor. */
export function EditorView({ yamlText, onChange, hint, onLoadTemplate }: EditorViewProps) {
  return (
    <div className="flex-1 flex flex-col p-6 gap-4 min-h-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium">Problem Definition</h2>
          <p className="text-sm mt-0.5 text-neutral-500 dark:text-neutral-400">
            Configure days, teachers, courses, rooms, and constraints in YAML.
          </p>
        </div>
        <button
          onClick={onLoadTemplate}
          className="shrink-0 px-3 py-1.5 text-sm flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          Load template
        </button>
      </div>

      {hint && (
        <span className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium border border-amber-200 dark:border-amber-500/30">
          <Info size={14} />
          {hint}
        </span>
      )}

      <textarea
        value={yamlText}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        placeholder="Paste a timetable problem in YAML, or load the template to start."
        className="flex-1 w-full resize-none rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-4 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}
