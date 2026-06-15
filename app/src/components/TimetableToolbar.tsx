import { Search, X } from "lucide-react";
import type { FilterOptions, Perspective, TimetableFilters } from "../lib/timetable-filters";

const PERSPECTIVES: { value: Perspective; label: string }[] = [
  { value: "class", label: "By class" },
  { value: "teacher", label: "By teacher" },
  { value: "room", label: "By room" },
  { value: "master", label: "Master" },
];

interface TimetableToolbarProps {
  perspective: Perspective;
  onPerspective: (value: Perspective) => void;
  filters: TimetableFilters;
  onFilters: (filters: TimetableFilters) => void;
  options: FilterOptions;
  query: string;
  onQuery: (value: string) => void;
  visibleCount: number;
  totalCount: number;
  onReset: () => void;
}

function Facet({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <label className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-neutral-200 bg-transparent py-1 pl-2 pr-6 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-neutral-800 dark:text-neutral-200"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Perspective switch + combinable facets + entity focus for the Timetable. */
export function TimetableToolbar(props: TimetableToolbarProps) {
  const { perspective, onPerspective, filters, onFilters, options, query, onQuery } = props;
  const facetsActive = filters.type || filters.department || filters.semester || query;

  return (
    <div className="flex flex-col gap-3 border-b border-neutral-200 px-8 py-4 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
          {PERSPECTIVES.map((p) => {
            const active = p.value === perspective;
            return (
              <button
                key={p.value}
                onClick={() => onPerspective(p.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Showing {props.visibleCount} of {props.totalCount} sessions
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Facet
          label="Type"
          value={filters.type}
          options={options.types}
          onChange={(type) => onFilters({ ...filters, type })}
        />
        <Facet
          label="Department"
          value={filters.department}
          options={options.departments}
          onChange={(department) => onFilters({ ...filters, department })}
        />
        <Facet
          label="Semester"
          value={filters.semester}
          options={options.semesters}
          onChange={(semester) => onFilters({ ...filters, semester })}
        />
        {perspective !== "master" && (
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Focus an entity..."
              className="w-44 rounded-md border border-neutral-200 bg-transparent py-1 pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-neutral-800"
            />
          </div>
        )}
        {facetsActive && (
          <button
            onClick={props.onReset}
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            <X size={13} />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
