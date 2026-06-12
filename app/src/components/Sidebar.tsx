import { useState } from "react";
import {
  AlignLeft,
  FileCode2,
  GraduationCap,
  Network,
  Search,
  Square,
  UploadCloud,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import type { ProblemEntities } from "../lib/entities";
import type { EntityKind } from "../lib/entity-forms";

export type { EntityKind };
export type NavSelection =
  | { kind: "editor" }
  | { kind: "constraints" }
  | { kind: "entity"; entity: EntityKind };

interface SidebarProps {
  entities: ProblemEntities | null;
  /** Null while the timeline view is active - no nav item highlights. */
  selection: NavSelection | null;
  onSelect: (selection: NavSelection) => void;
  onImport: () => void;
}

const DATA_SOURCES: { entity: EntityKind; label: string; icon: LucideIcon }[] = [
  { entity: "subjects", label: "Courses", icon: AlignLeft },
  { entity: "teachers", label: "Professors", icon: Users },
  { entity: "groups", label: "Student Groups", icon: GraduationCap },
  { entity: "rooms", label: "Rooms", icon: Square },
];

const itemClass = (active: boolean): string =>
  `w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left ${
    active
      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium"
      : "text-neutral-500 dark:text-neutral-400 hover:bg-black/5 dark:hover:bg-white/5"
  }`;

/** Left navigation pane: brand header, entity search, data sources, and
    the CSV import entry point. */
export function Sidebar({ entities, selection, onSelect, onImport }: SidebarProps) {
  const [query, setQuery] = useState("");
  const counts: Record<EntityKind, number> = {
    subjects: entities?.subjects.length ?? 0,
    teachers: entities?.teachers.length ?? 0,
    groups: entities?.groups.length ?? 0,
    rooms: entities?.rooms.length ?? 0,
  };
  const sources = DATA_SOURCES.filter((source) =>
    source.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <aside className="w-60 shrink-0 flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50">
      <div className="flex items-center gap-2.5 p-4 pb-3">
        <BrandLogo variant="primary" size={26} animated={false} />
        <div>
          <h1 className="text-base font-bold tracking-tight leading-none">ChronoSolve</h1>
          <p className="text-[11px] mt-1 text-neutral-500 dark:text-neutral-400">Timetable Solver</p>
        </div>
      </div>

      <div className="px-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400"
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search entities..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-transparent border border-neutral-200 dark:border-neutral-800 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <nav className="p-3 space-y-1">
        <div className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 text-neutral-500 dark:text-neutral-400">
          Project
        </div>
        <button
          className={itemClass(selection?.kind === "editor")}
          onClick={() => onSelect({ kind: "editor" })}
        >
          <FileCode2 size={16} />
          Problem Definition
        </button>
        <button
          className={itemClass(selection?.kind === "constraints")}
          onClick={() => onSelect({ kind: "constraints" })}
        >
          <Network size={16} />
          Constraints
        </button>

        <div className="text-[10px] uppercase font-bold tracking-wider px-3 py-1 pt-4 text-neutral-500 dark:text-neutral-400">
          Data Sources
        </div>
        {sources.map((source) => {
          const active = selection?.kind === "entity" && selection.entity === source.entity;
          return (
            <button
              key={source.entity}
              className={itemClass(active)}
              onClick={() => onSelect({ kind: "entity", entity: source.entity })}
            >
              <source.icon size={16} />
              {source.label}
              <span className="ml-auto font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                {counts[source.entity]}
              </span>
            </button>
          );
        })}

        <button className={itemClass(false)} onClick={onImport}>
          <UploadCloud size={16} />
          Import CSV…
        </button>
      </nav>
    </aside>
  );
}
