import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { CalendarDays, Database, Edit2, Lock, Play, Unlock } from "lucide-react";
import { useWorkspace } from "../providers/problem-doc-provider";
import { listEntities } from "../lib/problem-doc";
import { scheduleKey } from "../lib/grid";
import type { ScheduleEntry } from "../lib/solver-client";
import {
  applyFilters,
  buildLookups,
  deriveFilterOptions,
  EMPTY_FILTERS,
  pivotByAxis,
  type Axis,
  type Perspective,
  type TimetableFilters,
} from "../lib/timetable-filters";
import { WeeklyGrid } from "../components/WeeklyGrid";
import { TimetableToolbar } from "../components/TimetableToolbar";
import { SessionPanel } from "../components/SessionPanel";
import { EntityFormDialog } from "../components/EntityFormDialog";
import { ContextMenu, type MenuState } from "../components/ContextMenu";

function CenteredState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: typeof Database;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative z-10 flex h-full items-center justify-center p-8" data-tour="timetable">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
          <Icon size={28} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{body}</p>
        <div className="mt-6 flex justify-center">{children}</div>
      </div>
    </div>
  );
}

export function TimetableRoute() {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const [perspective, setPerspective] = useState<Perspective>("class");
  const [filters, setFilters] = useState<TimetableFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<MenuState | null>(null);

  const entities = ws.entities;
  const lookups = useMemo(() => (entities ? buildLookups(entities) : null), [entities]);
  const options = useMemo(() => (entities ? deriveFilterOptions(entities) : null), [entities]);
  const filtered = useMemo(
    () => (lookups ? applyFilters(ws.schedule, filters, lookups) : ws.schedule),
    [ws.schedule, filters, lookups],
  );

  const name = (map: Map<string, string>, id: string) => map.get(id) ?? id;
  const teacherNames = useMemo(
    () => new Map((entities?.teachers ?? []).map((t) => [t.id, t.name])),
    [entities],
  );
  const groupNames = useMemo(() => new Map((entities?.groups ?? []).map((g) => [g.id, g.name])), [entities]);

  if (!ws.doc) {
    return (
      <CenteredState
        icon={Database}
        title="No problem loaded"
        body="Add courses, instructors, rooms, and groups first - then run the scheduler to see the timetable."
      >
        <button
          onClick={() => navigate("/data")}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          Go to Data
        </button>
      </CenteredState>
    );
  }

  if (ws.schedule.length === 0) {
    return (
      <CenteredState
        icon={CalendarDays}
        title="No timetable yet"
        body="Run the scheduler to generate a conflict-free timetable. It will appear here, filterable by class, teacher, room, type, department, and semester."
      >
        <button
          onClick={() => {
            ws.solve();
            navigate("/solver");
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <Play size={16} className={ws.busy ? "animate-spin" : ""} />
          Run scheduler
        </button>
      </CenteredState>
    );
  }

  const days =
    entities && entities.days.length > 0 ? entities.days : [...new Set(ws.schedule.map((e) => e.day))];
  const maxSlot = Math.max(entities?.slotsPerDay ?? 0, ...ws.schedule.map((e) => e.slot));
  const slots = Array.from({ length: maxSlot }, (_, index) => index + 1);
  const slotLabels = entities?.slotLabels ?? {};
  const lockedKeys = ws.locks.lockedKeys;
  const roomName = (id: string | null) => (id ? name(ws.roomNames, id) : "-");

  const secondary = (entry: ScheduleEntry) =>
    perspective === "teacher" || perspective === "room"
      ? entry.group_ids.map((g) => name(groupNames, g)).join(", ")
      : entry.room_id
        ? name(ws.roomNames, entry.room_id)
        : "";

  const openMenu = (event: React.MouseEvent, entry: ScheduleEntry) => {
    event.preventDefault();
    ws.setSelected(entry);
    const locked = lockedKeys.has(scheduleKey(entry.subject_id, entry.day, entry.slot));
    setMenu({
      x: event.clientX,
      y: event.clientY,
      width: "w-64",
      header: [entry.subject_id, entry.room_id ? roomName(entry.room_id) : null].filter(Boolean).join(" • "),
      items: [
        locked
          ? {
              label: "Unpin from slot",
              icon: Unlock,
              shortcut: "P",
              onSelect: () => ws.locks.unpinBlock(entry),
            }
          : { label: "Pin to slot", icon: Lock, shortcut: "P", onSelect: () => ws.locks.pinBlock(entry) },
        {
          label: "Edit course",
          icon: Edit2,
          shortcut: "⌘E",
          onSelect: () => ws.editing.openEdit("subjects", entry.subject_id),
        },
      ],
    });
  };

  const gridProps = {
    days,
    slots,
    slotLabels,
    lockedKeys,
    selected: ws.selected,
    secondary,
    onSelect: ws.setSelected,
    onContextMenu: openMenu,
  };
  const entityName = (id: string) =>
    perspective === "teacher"
      ? name(teacherNames, id)
      : perspective === "room"
        ? roomName(id)
        : name(groupNames, id);

  let grids: React.ReactNode;
  if (perspective === "master") {
    grids = (
      <WeeklyGrid
        title="Master timetable"
        subtitle={`${filtered.length} sessions`}
        sessions={filtered}
        {...gridProps}
      />
    );
  } else {
    const pivot = pivotByAxis(filtered, perspective as Axis);
    const ids = [...pivot.keys()]
      .filter(
        (id) =>
          query.trim() === "" || `${id} ${entityName(id)}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
      .sort((a, b) => entityName(a).localeCompare(entityName(b), undefined, { numeric: true }));
    grids =
      ids.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
          No sessions match these filters.
        </p>
      ) : (
        ids.map((id) => {
          const sessions = pivot.get(id) ?? [];
          return (
            <WeeklyGrid
              key={id}
              title={entityName(id)}
              subtitle={`${id} · ${sessions.length} sessions`}
              sessions={sessions}
              {...gridProps}
            />
          );
        })
      );
  }

  const selected = ws.selected;
  return (
    <div className="relative z-10 flex h-full overflow-hidden" data-tour="timetable">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-8 pt-6">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Timetable
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            The solved schedule. Switch perspective and combine filters to focus any slice.
          </p>
        </div>
        {options && (
          <div data-tour="timetable-toolbar">
            <TimetableToolbar
              perspective={perspective}
              onPerspective={setPerspective}
              filters={filters}
              onFilters={setFilters}
              options={options}
              query={query}
              onQuery={setQuery}
              visibleCount={filtered.length}
              totalCount={ws.schedule.length}
              onReset={() => {
                setFilters(EMPTY_FILTERS);
                setQuery("");
              }}
            />
          </div>
        )}
        <div className="flex-1 space-y-10 overflow-auto p-8" data-tour="timetable-grid">
          {grids}
        </div>
      </div>

      {selected && (
        <SessionPanel
          entry={selected}
          subjectName={name(ws.subjectNames, selected.subject_id)}
          roomName={roomName(selected.room_id)}
          teacherNames={selected.teacher_ids.map((id) => name(teacherNames, id))}
          groupNames={selected.group_ids.map((id) => name(groupNames, id))}
          slotLabel={slotLabels[selected.slot] ?? String(selected.slot)}
          locked={lockedKeys.has(scheduleKey(selected.subject_id, selected.day, selected.slot))}
          onClose={() => ws.setSelected(null)}
          onToggleLock={() => ws.locks.toggleLock(selected)}
          onEdit={() => ws.editing.openEdit("subjects", selected.subject_id)}
        />
      )}

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

      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
