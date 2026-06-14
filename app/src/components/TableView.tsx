import { useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Edit2, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import type { ProblemEntities } from "../lib/entities";
import type { EntityKind } from "../lib/entity-forms";
import { ContextMenu, type MenuState } from "./ContextMenu";

interface TableViewProps {
  entities: ProblemEntities;
  entity: EntityKind;
  /** Scheduled slot count per subject id, once a solve has completed. */
  scheduledCounts: Map<string, number> | null;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

interface Row {
  id: string;
  name: string;
  cells: string[];
  status?: { ok: boolean; label: string };
}

const LABELS: Record<EntityKind, { title: string; singular: string; columns: string[] }> = {
  subjects: {
    title: "courses",
    singular: "course",
    columns: ["Hours / Week", "Instructors", "Groups", "Status"],
  },
  teachers: { title: "instructors", singular: "instructor", columns: ["Unavailable"] },
  groups: { title: "student groups", singular: "group", columns: ["Size", "Department", "Semester"] },
  rooms: { title: "rooms", singular: "room", columns: ["Capacity", "Type"] },
};

function buildRows(entities: ProblemEntities, entity: EntityKind, counts: Map<string, number> | null): Row[] {
  if (entity === "teachers")
    return entities.teachers.map((row) => ({ ...row, cells: [row.unavailable || "-"] }));
  if (entity === "groups")
    return entities.groups.map((row) => ({
      ...row,
      cells: [row.size?.toString() ?? "-", row.department || "-", row.semester || "-"],
    }));
  if (entity === "rooms")
    return entities.rooms.map((row) => ({ ...row, cells: [row.capacity?.toString() ?? "-", row.type] }));
  return entities.subjects.map((row) => ({
    ...row,
    cells: [row.hoursPerWeek.toString(), row.teacherIds.join(", "), row.groupIds.join(", ")],
    status: counts
      ? (counts.get(row.id) ?? 0) >= row.hoursPerWeek
        ? { ok: true, label: "Scheduled" }
        : { ok: false, label: "Missing hours" }
      : undefined,
  }));
}

/** High-density entity table with add/edit/delete affordances, per the
    design system's Data Display + Context Menus specs. */
export function TableView({ entities, entity, scheduledCounts, onAdd, onEdit, onDelete }: TableViewProps) {
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<MenuState | null>(null);
  const { title, singular, columns } = LABELS[entity];
  const allRows = buildRows(entities, entity, scheduledCounts);
  const rows = allRows.filter((row) =>
    `${row.id} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const showStatus = entity === "subjects" && scheduledCounts !== null;
  const headers = ["ID", "Name", ...columns.filter((column) => column !== "Status" || showStatus)];

  const rowMenu = (row: Row, x: number, y: number): MenuState => ({
    x,
    y,
    items: [
      {
        label: "Copy Row Data",
        icon: Copy,
        shortcut: "⌘C",
        onSelect: () =>
          void navigator.clipboard
            ?.writeText([row.id, row.name, ...row.cells].join("\t"))
            .catch((problem) => console.warn("Clipboard write failed", problem)),
      },
      { label: "Edit Record", icon: Edit2, shortcut: "↵", onSelect: () => onEdit(row.id) },
      "divider",
      {
        label: "Delete Record",
        icon: Trash2,
        shortcut: "⌘⌫",
        destructive: true,
        onSelect: () => onDelete(row.id),
      },
    ],
  });

  return (
    <div className="flex-1 p-6 min-h-0 overflow-auto">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm flex flex-col">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-64 max-w-full">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400"
            />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${title}...`}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-transparent border border-neutral-200 dark:border-neutral-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={onAdd}
            className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors capitalize"
          >
            <Plus size={14} />
            Add {singular}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400"
                  >
                    {header}
                  </th>
                ))}
                <th className="w-12 px-2 py-3" aria-label="Row actions" />
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu(rowMenu(row, event.clientX, event.clientY));
                  }}
                  className="border-b border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  {row.cells.map((cell, index) => (
                    <td key={index} className="px-4 py-3 text-neutral-500 dark:text-neutral-400">
                      {cell}
                    </td>
                  ))}
                  {row.status && (
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          row.status.ok
                            ? "text-teal-600 dark:text-teal-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {row.status.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        {row.status.label}
                      </span>
                    </td>
                  )}
                  <td className="px-2 py-3 text-right">
                    <button
                      title="Row actions"
                      aria-label="Row actions"
                      onClick={(event) => {
                        const anchor = event.currentTarget.getBoundingClientRect();
                        setMenu(rowMenu(row, anchor.right - 224, anchor.bottom + 4));
                      }}
                      className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 dark:text-neutral-500 transition-colors"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950">
          Showing {rows.length} of {allRows.length} {title}
        </div>
      </div>

      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
