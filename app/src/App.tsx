import { useEffect, useMemo, useState } from "react";
import { load as parseYaml } from "js-yaml";
import { solverClient, type ScheduleEntry, type SolveResult } from "./lib/solver-client";
import { parseEntities } from "./lib/entities";
import { Sidebar, type EntityKind, type NavSelection } from "./components/Sidebar";
import { Toolbar, type WorkspaceView } from "./components/Toolbar";
import { EditorView } from "./components/EditorView";
import { TableView } from "./components/TableView";
import { TimetableView } from "./components/TimetableView";
import { Inspector, type SessionDetails } from "./components/Inspector";
import { usePhase } from "./lib/use-phase";

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [yamlText, setYamlText] = useState("");
  const [view, setView] = useState<WorkspaceView>("editor");
  const [tableEntity, setTableEntity] = useState<EntityKind>("subjects");
  const [result, setResult] = useState<SolveResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [solveError, setSolveError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ScheduleEntry | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const parsed = useMemo(() => {
    if (!yamlText.trim()) return { problem: null, entities: null, yamlError: null };
    try {
      const problem = parseYaml(yamlText);
      return { problem, entities: parseEntities(problem), yamlError: null };
    } catch (problem) {
      const message = problem instanceof Error ? problem.message.split("\n")[0] : String(problem);
      return { problem: null, entities: null, yamlError: message };
    }
  }, [yamlText]);
  const { problem, entities, yamlError } = parsed;

  const { phase, elapsed, summary, metrics, unresolved } = usePhase({ busy, solveError, result, entities });

  const loadTemplate = async () => {
    try {
      setYamlText(await solverClient.template());
    } catch (problem) {
      setSolveError(String(problem));
    }
  };

  const solve = async () => {
    setBusy(true);
    setSolveError(null);
    setResult(null);
    setSelected(null);
    try {
      const solved = await solverClient.solve(problem);
      setResult(solved);
      if (solved.schedule.length > 0) setView("timeline");
    } catch (problem) {
      setSolveError(String(problem));
    } finally {
      setBusy(false);
    }
  };

  const navSelection: NavSelection | null =
    view === "editor" ? { kind: "editor" } : view === "table" ? { kind: "entity", entity: tableEntity } : null;

  const onNav = (selection: NavSelection) => {
    if (selection.kind === "editor") setView("editor");
    else {
      setTableEntity(selection.entity);
      setView("table");
    }
  };

  const scheduledCounts = useMemo(() => {
    if (!result) return null;
    const counts = new Map<string, number>();
    for (const entry of result.schedule) counts.set(entry.subject_id, (counts.get(entry.subject_id) ?? 0) + 1);
    return counts;
  }, [result]);

  const subjectNames = useMemo(
    () => new Map((entities?.subjects ?? []).map((subject) => [subject.id, subject.name])),
    [entities],
  );

  const lockedKeys = useMemo(
    () =>
      new Set(
        (entities?.preAssignments ?? []).map((pin) => `${pin.subjectId}|${pin.day}|${pin.slot}`),
      ),
    [entities],
  );

  const session: SessionDetails | null = useMemo(() => {
    if (!selected) return null;
    const teacherNames = new Map((entities?.teachers ?? []).map((teacher) => [teacher.id, teacher.name]));
    const roomNames = new Map((entities?.rooms ?? []).map((room) => [room.id, room.name]));
    return {
      code: selected.subject_id,
      name: subjectNames.get(selected.subject_id) ?? selected.subject_id,
      day: selected.day,
      slotLabel: entities?.slotLabels[selected.slot] ?? `Slot ${selected.slot}`,
      rows: [
        ["Instructor", selected.teacher_ids.map((id) => teacherNames.get(id) ?? id).join(", ") || "—"],
        ["Room", selected.room_id ? (roomNames.get(selected.room_id) ?? selected.room_id) : "—"],
        ["Groups", selected.group_ids.join(", ") || "—"],
        [
          "Placement",
          lockedKeys.has(`${selected.subject_id}|${selected.day}|${selected.slot}`)
            ? "Locked (pre-assigned)"
            : "Solver assigned",
        ],
      ],
    };
  }, [selected, entities, subjectNames, lockedKeys]);

  return (
    <div className="flex h-full font-sans text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-950">
      <Sidebar entities={entities} selection={navSelection} onSelect={onNav} />

      <main className="flex-1 flex flex-col min-w-0">
        <Toolbar
          view={view}
          onView={setView}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          busy={busy}
          canSolve={problem !== null}
          onSolve={solve}
        />
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-neutral-50 dark:bg-black bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]">
          {view === "editor" && (
            <EditorView yamlText={yamlText} onChange={setYamlText} yamlError={yamlError} onLoadTemplate={loadTemplate} />
          )}
          {view === "table" &&
            (entities ? (
              <TableView entities={entities} entity={tableEntity} scheduledCounts={scheduledCounts} />
            ) : (
              <EmptyHint label="No problem loaded — define one in the Problem Definition editor first." />
            ))}
          {view === "timeline" && (
            <TimetableView
              schedule={result?.schedule ?? []}
              days={entities?.days ?? []}
              slotCount={entities?.slotsPerDay ?? 0}
              slotLabels={entities?.slotLabels ?? {}}
              subjectNames={subjectNames}
              lockedKeys={lockedKeys}
              selected={selected}
              onSelect={setSelected}
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
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-12">
      <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-sm">{label}</p>
    </div>
  );
}
