import { useState } from "react";
import {
  AlignLeft,
  Database,
  GraduationCap,
  Square,
  UploadCloud,
  Users,
  type LucideIcon,
} from "lucide-react";
import { TableView } from "../components/TableView";
import { EntityFormDialog } from "../components/EntityFormDialog";
import { ImportWizard } from "../components/ImportWizard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { listEntities } from "../lib/problem-doc";
import type { EntityKind } from "../lib/entity-forms";
import { useWorkspace } from "../providers/problem-doc-provider";

const TABS: { kind: EntityKind; label: string; icon: LucideIcon }[] = [
  { kind: "subjects", label: "Courses", icon: AlignLeft },
  { kind: "teachers", label: "Instructors", icon: Users },
  { kind: "groups", label: "Student groups", icon: GraduationCap },
  { kind: "rooms", label: "Rooms", icon: Square },
];

const importButton =
  "inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700";

export function DataETLRoute() {
  const ws = useWorkspace();
  const [tab, setTab] = useState<EntityKind>("subjects");
  const [importing, setImporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const importModal = importing && (
    <ImportWizard doc={ws.doc} onApply={ws.editProblem} onClose={() => setImporting(false)} />
  );

  if (!ws.doc || !ws.entities) {
    return (
      <div
        className="relative z-10 flex h-full items-center justify-center overflow-y-auto p-8"
        data-tour="data"
      >
        <div className="max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
            <Database size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            No data loaded yet
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            Import your courses, instructors, rooms, and student groups from CSV, or start from a worked
            example and edit it in place.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={() => setImporting(true)} className={importButton}>
              <UploadCloud size={16} />
              Import from CSV
            </button>
            <button
              onClick={ws.loadTemplate}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Load example template
            </button>
          </div>
          {ws.templateError && <p className="mt-4 text-xs text-red-500">{ws.templateError}</p>}
        </div>
        {importModal}
      </div>
    );
  }

  const entities = ws.entities;

  return (
    <div className="relative z-10 flex h-full flex-col overflow-hidden" data-tour="data">
      <header className="px-8 pb-4 pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Data</h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Browse and edit your problem data, or pull it in from CSV. Next stop: constraints.
            </p>
          </div>
          <button onClick={() => setImporting(true)} className={importButton}>
            <UploadCloud size={16} />
            Import CSV
          </button>
        </div>

        <nav className="mt-6 inline-flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
          {TABS.map((t) => {
            const active = t.kind === tab;
            return (
              <button
                key={t.kind}
                onClick={() => setTab(t.kind)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <t.icon size={15} />
                {t.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                    active ? "bg-indigo-500/10 text-indigo-500" : "bg-neutral-200/60 dark:bg-neutral-700/60"
                  }`}
                >
                  {entities[t.kind].length}
                </span>
              </button>
            );
          })}
        </nav>
      </header>

      <TableView
        entities={entities}
        entity={tab}
        scheduledCounts={ws.scheduledCounts}
        onAdd={() => ws.editing.openAdd(tab)}
        onEdit={(id) => ws.editing.openEdit(tab, id)}
        onDelete={(id) => setPendingDelete(id)}
      />

      {ws.editing.target && (
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

      {importModal}
    </div>
  );
}
