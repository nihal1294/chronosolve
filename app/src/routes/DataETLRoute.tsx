import { useState } from "react";
import { useSearchParams } from "react-router";
import {
  AlignLeft,
  FolderOpen,
  GraduationCap,
  Square,
  UploadCloud,
  Users,
  type LucideIcon,
} from "lucide-react";
import { TableView } from "../components/TableView";
import { EditorView } from "../components/EditorView";
import { EntityFormDialog } from "../components/EntityFormDialog";
import { ImportWizard } from "../components/ImportWizard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataEmptyState } from "../components/DataEmptyState";
import { listEntities } from "../lib/problem-doc";
import { REGENERATED_HINT } from "../lib/use-problem-doc";
import type { EntityKind } from "../lib/entity-forms";
import { useWorkspace } from "../providers/problem-doc-provider";

type View = "tables" | "source";

const TABS: { kind: EntityKind; label: string; icon: LucideIcon }[] = [
  { kind: "subjects", label: "Courses", icon: AlignLeft },
  { kind: "teachers", label: "Instructors", icon: Users },
  { kind: "groups", label: "Student groups", icon: GraduationCap },
  { kind: "rooms", label: "Rooms", icon: Square },
];

const segment = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
  }`;
const groupBox =
  "inline-flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900";
const headerBtn =
  "inline-flex shrink-0 items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";

export function DataETLRoute() {
  const ws = useWorkspace();
  const [view, setView] = useState<View>("tables");
  const [tab, setTab] = useState<EntityKind>("subjects");
  const [importing, setImporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // "Import CSV" (here or from the palette via ?import=1) opens the wizard,
  // derived at render so any route can trigger it (no set-state-in-effect).
  const showImport = importing || searchParams.get("import") === "1";
  const closeImport = () => {
    setImporting(false);
    if (searchParams.has("import")) {
      searchParams.delete("import");
      setSearchParams(searchParams, { replace: true });
    }
  };

  const entities = ws.entities;
  const sourceHint =
    ws.parseError ?? ws.fileError ?? ws.templateError ?? (ws.regenerated ? REGENERATED_HINT : null);

  return (
    <div className="relative z-10 flex h-full flex-col overflow-hidden" data-tour="data">
      <header className="px-8 pb-4 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Data</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Edit as structured tables or as raw YAML. Open a file, or import entities from CSV.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={ws.openFile} className={headerBtn}>
              <FolderOpen size={16} />
              Open file
            </button>
            <button onClick={() => setImporting(true)} className={headerBtn}>
              <UploadCloud size={16} />
              Import CSV
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className={groupBox}>
            <button onClick={() => setView("tables")} className={segment(view === "tables")}>
              Tables
            </button>
            <button onClick={() => setView("source")} className={segment(view === "source")}>
              YAML
            </button>
          </div>
          {view === "tables" && entities && (
            <nav className={groupBox}>
              {TABS.map((t) => (
                <button
                  key={t.kind}
                  onClick={() => setTab(t.kind)}
                  className={`inline-flex items-center gap-2 ${segment(t.kind === tab)}`}
                >
                  <t.icon size={15} />
                  {t.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                      t.kind === tab
                        ? "bg-indigo-500/10 text-indigo-500"
                        : "bg-neutral-200/60 dark:bg-neutral-700/60"
                    }`}
                  >
                    {entities[t.kind].length}
                  </span>
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      {view === "source" ? (
        <EditorView
          yamlText={ws.yamlText}
          onChange={ws.writeYaml}
          hint={sourceHint}
          onLoadTemplate={ws.loadTemplate}
          fileActions={{ onOpen: ws.openFile, onSave: ws.saveFile }}
        />
      ) : entities ? (
        <TableView
          entities={entities}
          entity={tab}
          scheduledCounts={ws.scheduledCounts}
          onAdd={() => ws.editing.openAdd(tab)}
          onEdit={(id) => ws.editing.openEdit(tab, id)}
          onDelete={(id) => setPendingDelete(id)}
        />
      ) : (
        <DataEmptyState
          onLoadTemplate={ws.loadTemplate}
          onOpenFile={ws.openFile}
          onImport={() => setImporting(true)}
          error={ws.templateError ?? ws.fileError}
        />
      )}

      {ws.editing.target && ws.doc && (
        <EntityFormDialog
          section={ws.editing.target.section}
          initial={ws.editing.target.initial}
          entities={entities}
          existingIds={listEntities(ws.doc, ws.editing.target.section).map((entity) => String(entity.id))}
          onSave={ws.editing.save}
          onClose={ws.editing.close}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this record?"
          message={`"${pendingDelete}" will be removed from the problem definition. This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            ws.editing.remove(tab, pendingDelete);
            setPendingDelete(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}

      {showImport && <ImportWizard doc={ws.doc} onApply={ws.editProblem} onClose={closeImport} />}
    </div>
  );
}
