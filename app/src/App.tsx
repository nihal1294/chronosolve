import { useEffect, useMemo, useState } from "react";
import { solverClient } from "./lib/solver-client";
import { parseEntities } from "./lib/entities";
import { countScheduled } from "./lib/grid";
import { listEntities, type ProblemDoc } from "./lib/problem-doc";
import { buildSessionDetails } from "./lib/session-details";
import { REGENERATED_HINT, useProblemDoc } from "./lib/use-problem-doc";
import { useEntityEditing } from "./lib/use-entity-editing";
import { isTauri, useProblemFile } from "./lib/use-problem-file";
import { useSolveState } from "./lib/use-solve-state";
import { useCommandCenter } from "./lib/use-commands";
import { useEntityNames } from "./lib/use-entity-names";
import { useTimelineLocks } from "./lib/use-timeline-locks";
import { useWorkspaceNav } from "./lib/use-workspace-nav";
import { AnalyticsView } from "./components/AnalyticsView";
import { usePhase } from "./lib/use-phase";
import { CommandPalette } from "./components/CommandPalette";
import { ConstraintsView } from "./components/ConstraintsView";
import { EmptyHint } from "./components/EmptyHint";
import { EntityFormDialog } from "./components/EntityFormDialog";
import { ImportWizard } from "./components/ImportWizard";
import { ShortcutSheet } from "./components/ShortcutSheet";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { EditorView } from "./components/EditorView";
import { TableView } from "./components/TableView";
import { TimetableView } from "./components/TimetableView";
import { Inspector } from "./components/Inspector";

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const nav = useWorkspaceNav();
  const { view, setView, tableEntity } = nav;
  const { yamlText, doc, parseError, regenerated, editYaml, applyDocEdit } = useProblemDoc();
  const solver = useSolveState(doc, (solved) => {
    if (solved.schedule.length > 0) setView("timeline");
  });
  const { result, selected, setSelected, busy, solveError, solve, invalidate } = solver;

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
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // The parsed doc is canonical: entity summaries derive from it, structured
  // editors update it, and solving posts it verbatim to the sidecar.
  const entities = useMemo(() => (doc ? parseEntities(doc) : null), [doc]);

  const phaseInputs = { busy, solveError, result, entities, progress: solver.progress };
  const { phase, elapsed, summary, metrics, unresolved } = usePhase(phaseInputs);

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

  const schedule = useMemo(() => result?.schedule ?? [], [result]);
  const scheduledCounts = useMemo(() => (result ? countScheduled(result.schedule) : null), [result]);
  const locks = useTimelineLocks(entities, schedule, editing.pin, editing.unpin);

  const { subjectNames, roomNames } = useEntityNames(entities);

  const session = useMemo(() => {
    if (!selected) return null;
    const locked = locks.lockedKeys.has(`${selected.subject_id}|${selected.day}|${selected.slot}`);
    return buildSessionDetails(selected, entities, locked);
  }, [selected, entities, locks.lockedKeys]);

  const palette = useCommandCenter({
    canSolve: doc !== null,
    busy,
    solve,
    cancel: solver.cancel,
    loadTemplate,
    openImport: () => setImporting(true),
    fileActions: isTauri() ? { onOpen: openFile, onSave: saveFile } : null,
    goToView: setView,
    goToTable: nav.goToTable,
    toggleSelectedLock: selected ? () => locks.toggleLock(selected) : null,
  });

  return (
    <div className="flex h-full font-sans text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-950">
      <Sidebar
        entities={entities}
        selection={nav.navSelection}
        onSelect={nav.onNav}
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
          {view === "analytics" && (
            <AnalyticsView
              doc={doc}
              result={result}
              entities={entities}
              objective={solver.progress?.objective ?? null}
              lastObjective={solver.lastObjective}
            />
          )}
          {view === "timeline" && (
            <TimetableView
              schedule={schedule}
              days={entities?.days ?? []}
              slotCount={entities?.slotsPerDay ?? 0}
              slotLabels={entities?.slotLabels ?? {}}
              subjectNames={subjectNames}
              roomNames={roomNames}
              lockedKeys={locks.lockedKeys}
              selected={selected}
              onSelect={setSelected}
              onPin={locks.pinBlock}
              onUnpin={locks.unpinBlock}
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
      {palette.paletteOpen && <CommandPalette commands={palette.commands} onClose={palette.closePalette} />}
      {palette.shortcutsOpen && (
        <ShortcutSheet commands={palette.commands} onClose={palette.closeShortcuts} />
      )}
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
