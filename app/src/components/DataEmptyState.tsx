import { Database, FileText, FolderOpen, UploadCloud } from "lucide-react";

interface DataEmptyStateProps {
  onLoadTemplate: () => void;
  onOpenFile: () => void;
  onImport: () => void;
  error: string | null;
}

const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700";
const ghost =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";

/** Get-started panel for the Data route's Tables view when no problem is loaded.
    Offers all three input paths so YAML/JSON is as obvious as CSV. */
export function DataEmptyState({ onLoadTemplate, onOpenFile, onImport, error }: DataEmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
      <div className="max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
          <Database size={28} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          No data loaded yet
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          Load a worked example, open your own YAML or JSON problem file, or import entities from CSV. You can
          also switch to the YAML view above and paste a definition.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={onLoadTemplate} className={primary}>
            <FileText size={16} />
            Load example
          </button>
          <button onClick={onOpenFile} className={ghost}>
            <FolderOpen size={16} />
            Open file
          </button>
          <button onClick={onImport} className={ghost}>
            <UploadCloud size={16} />
            Import CSV
          </button>
        </div>
        {error && <p className="mt-4 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
