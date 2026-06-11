import { useState } from "react";
import { AlertCircle, CheckCircle2, Search } from "lucide-react";
import type { ProblemEntities } from "../lib/entities";
import type { EntityKind } from "./Sidebar";

interface TableViewProps {
  entities: ProblemEntities;
  entity: EntityKind;
  /** Scheduled slot count per subject id, once a solve has completed. */
  scheduledCounts: Map<string, number> | null;
}

interface Row {
  id: string;
  name: string;
  cells: string[];
  status?: { ok: boolean; label: string };
}

const LABELS: Record<EntityKind, { title: string; columns: string[] }> = {
  subjects: { title: "courses", columns: ["Hours / Week", "Instructors", "Groups", "Status"] },
  teachers: { title: "professors", columns: ["Unavailable"] },
  groups: { title: "student groups", columns: ["Size"] },
  rooms: { title: "rooms", columns: ["Capacity", "Type"] },
};

function buildRows(entities: ProblemEntities, entity: EntityKind, counts: Map<string, number> | null): Row[] {
  if (entity === "teachers")
    return entities.teachers.map((row) => ({ ...row, cells: [row.unavailable || "—"] }));
  if (entity === "groups")
    return entities.groups.map((row) => ({ ...row, cells: [row.size?.toString() ?? "—"] }));
  if (entity === "rooms")
    return entities.rooms.map((row) => ({ ...row, cells: [row.capacity?.toString() ?? "—", row.type] }));
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

/** High-density entity table, per the design system's Data Display spec. */
export function TableView({ entities, entity, scheduledCounts }: TableViewProps) {
  const [query, setQuery] = useState("");
  const { title, columns } = LABELS[entity];
  const rows = buildRows(entities, entity, scheduledCounts).filter((row) =>
    `${row.id} ${row.name}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const showStatus = entity === "subjects" && scheduledCounts !== null;
  const headers = ["ID", "Name", ...columns.filter((column) => column !== "Status" || showStatus)];

  return (
    <div className="flex-1 p-6 min-h-0 overflow-auto">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm flex flex-col">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${title}...`}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-transparent border border-neutral-200 dark:border-neutral-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800">
                {headers.map((header) => (
                  <th key={header} className="px-4 py-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.map((row) => (
                <tr
                  key={row.id}
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
                          row.status.ok ? "text-teal-600 dark:text-teal-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {row.status.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        {row.status.label}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950">
          Showing {rows.length} of {buildRows(entities, entity, scheduledCounts).length} {title}
        </div>
      </div>
    </div>
  );
}
