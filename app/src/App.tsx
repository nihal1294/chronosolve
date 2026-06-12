import { useEffect, useMemo, useState } from "react";
import { solverClient } from "./lib/solver-client";
import { parseEntities } from "./lib/entities";
import { countScheduled } from "./lib/grid";
import { listEntities, type ProblemDoc } from "./lib/problem-doc";
import { buildSessionDetails } from "./lib/session-details";
import { REGENERATED_HINT, useProblemDoc } from "./lib/use-problem-doc";
import { useEntityEditing } from "./lib/use-entity-editing";
import { isTauri, useProblemFile } from "./lib/use-problem-file";
import { useSolveShortcut } from "./lib/use-solve-shortcut";
import { useSolveState } from "./lib/use-solve-state";
import { usePhase } from "./lib/use-phase";
import { ConstraintsView } from "./components/ConstraintsView";
import { EmptyHint } from "./components/EmptyHint";
import { EntityFormDialog } from "./components/EntityFormDialog";
import { ImportWizard } from "./components/ImportWizard";
import { Sidebar, type EntityKind, type NavSelection } from "./components/Sidebar";
import { Toolbar, type WorkspaceView } from "./components/Toolbar";
import { EditorView } from "./components/EditorView";
import { TableView } from "./components/TableView";
import { TimetableView } from "./components/TimetableView";
import { Inspector } from "./components/Inspector";

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [view, setView] = useState<WorkspaceView>("editor");
  const { yamlText, doc, parseError, regenerated, editYaml, applyDocEdit } = useProblemDoc();
  const { result, selected, setSelected, busy, solveError, solve, invalidate } = useSolveState(
    doc,
    (solved) => {
      if (solved.schedule.length > 0) setView("timeline");
    },
  );

  // Every problem change makes a displayed schedule stale - except pin/unpin,
  // which record slots taken from that very schedule, so it stays valid.
  const editProblem = (next: ProblemDoc) => {
    applyDocEdit(next);
    invalidate();
  };
  const writeYaml = (text: string) => {
    editYaml(text);
    invalidate();
  };

  const editing = useEntityEditing(doc, editProblem, applyDocEdit);
  const { fileError, openFile, saveFile } = useProblemFile(yamlText, writeYaml);
  const [importing, setImporting] = useState(false);
  const [tableEntity, setTableEntity] = useState<EntityKind>("subjects");
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // The parsed doc is canonical: entity summaries derive from it, structured
  // editors update it, and solving posts it verbatim to the sidecar.
  const entities = useMemo(() => (doc ? parseEntities(doc) : null), [doc]);

  const { phase, elapsed, summary, metrics, unresolved } = usePhase({ busy, solveError, result, entities });

  // A template fetch failure is an editor problem, not a solve outcome -
  // it must not light up the Inspector's "Solver Error" card.
  const loadTemplate = async () => {
    setTemplateError(null);
    try {
      writeYaml(await solverClient.template());
    } catch (problem) {
      setTemplateError(
        `Template load failed: ${problem instanceof Error ? problem.message : String(problem)}`,
      );
    }
  };

  useSolveShortcut(solve);

  const navSelection: NavSelection | null =
    view === "editor" || view === "constraints"
      ? { kind: view }
      : view === "table"
        ? { kind: "entity", entity: tableEntity }
        : null;

  const onNav = (selection: NavSelection) => {
    if (selection.kind === "entity") {
      setTableEntity(selection.entity);
      setView("table");
    } else setView(selection.kind);
  };

  const scheduledCounts = useMemo(() => (result ? countScheduled(result.schedule) : null), [result]);

  const subjectNames = useMemo(
    () => new Map((entities?.subjects ?? []).map((subject) => [subject.id, subject.name])),
    [entities],
  );

  const roomNames = useMemo(
    () => new Map((entities?.rooms ?? []).map((room) => [room.id, room.name])),
    [entities],
  );

  const lockedKeys = useMemo(
    () => new Set((entities?.preAssignments ?? []).map((pin) => `${pin.subjectId}|${pin.day}|${pin.slot}`)),
    [entities],
  );

  const session = useMemo(() => {
    if (!selected) return null;
    const locked = lockedKeys.has(`${selected.subject_id}|${selected.day}|${selected.slot}`);
    return buildSessionDetails(selected, entities, locked);
  }, [selected, entities, lockedKeys]);

  return (
    <div className="flex h-full font-sans text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-950">
      <Sidebar
        entities={entities}
        selection={navSelection}
        onSelect={onNav}
        onImport={() => setImporting(true)}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <Toolbar
          view={view}
          onView={setView}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          busy={busy}
          canSolve={doc !== null}
          onSolve={solve}
        />
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-neutral-50 dark:bg-black bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
          {view === "editor" && (
            <EditorView
              yamlText={yamlText}
              onChange={writeYaml}
              hint={parseError ?? templateError ?? fileError ?? (regenerated ? REGENERATED_HINT : null)}
              onLoadTemplate={loadTemplate}
              fileActions={isTauri() ? { onOpen: openFile, onSave: saveFile } : null}
            />
          )}
          {view === "constraints" && <ConstraintsView doc={doc} onEdit={editProblem} />}
          {view === "table" &&
            (entities ? (
              <TableView
                entities={entities}
                entity={tableEntity}
                scheduledCounts={scheduledCounts}
                onAdd={() => editing.openAdd(tableEntity)}
                onEdit={(id) => editing.openEdit(tableEntity, id)}
                onDelete={(id) => editing.remove(tableEntity, id)}
              />
            ) : (
              <EmptyHint label="No problem loaded - define one in the Problem Definition editor first." />
            ))}
          {view === "timeline" && (
            <TimetableView
              schedule={result?.schedule ?? []}
              days={entities?.days ?? []}
              slotCount={entities?.slotsPerDay ?? 0}
              slotLabels={entities?.slotLabels ?? {}}
              subjectNames={subjectNames}
              roomNames={roomNames}
              lockedKeys={lockedKeys}
              selected={selected}
              onSelect={setSelected}
              onPin={editing.pin}
              onUnpin={editing.unpin}
              onEditSubject={(id) => editing.openEdit("subjects", id)}
            />
          )}
        </div>
      </main>

      <Inspector
        phase={phase}
        elapsed={elapsed}
        summary={summary}
        unresolved={unresolved}
        metrics={metrics}
        session={session}
      />

      {importing && <ImportWizard doc={doc} onApply={editProblem} onClose={() => setImporting(false)} />}
      {editing.target && doc && (
        <EntityFormDialog
          section={editing.target.section}
          initial={editing.target.initial}
          entities={entities}
          existingIds={listEntities(doc, editing.target.section).map((entity) => String(entity.id))}
          onSave={editing.save}
          onClose={editing.close}
        />
      )}
    </div>
  );
}
