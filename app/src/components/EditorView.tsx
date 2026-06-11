import { Info } from "lucide-react";

interface EditorViewProps {
  yamlText: string;
  onChange: (text: string) => void;
  /** Editor-scoped notice: YAML parse hint, template/file failure, or the
      comment-loss note shown after a structured edit regenerates the text. */
  hint: string | null;
  onLoadTemplate: () => void;
  /** Native open/save; hidden in the browser preview (no Tauri shell). */
  fileActions: { onOpen: () => void; onSave: () => void } | null;
}

const ACTION_CLASS =
  "shrink-0 px-3 py-1.5 text-sm flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-40";

/** Center workspace: the YAML problem definition editor. */
export function EditorView({ yamlText, onChange, hint, onLoadTemplate, fileActions }: EditorViewProps) {
  return (
    <div className="flex-1 flex flex-col p-6 gap-4 min-h-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium">Problem Definition</h2>
          <p className="text-sm mt-0.5 text-neutral-500 dark:text-neutral-400">
            Configure days, teachers, courses, rooms, and constraints in YAML.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fileActions && (
            <>
              <button onClick={fileActions.onOpen} className={ACTION_CLASS}>
                Open…
              </button>
              <button onClick={fileActions.onSave} disabled={!yamlText.trim()} className={ACTION_CLASS}>
                Save…
              </button>
            </>
          )}
          <button onClick={onLoadTemplate} className={ACTION_CLASS}>
            Load template
          </button>
        </div>
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
