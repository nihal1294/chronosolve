import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { IMPORT_FIELDS } from "../lib/csv-import";
import type { EntitySection } from "../lib/problem-doc";

interface ImportMappingGridProps {
  section: EntitySection;
  headers: readonly string[];
  rowCount: number;
  /** CSV header -> destination field key ("" = unmapped). */
  mapping: Record<string, string>;
  /** Header keys the auto-matcher filled (rendered in the teal style). */
  autoMatched: ReadonlySet<string>;
  onMap: (header: string, fieldKey: string) => void;
}

const SELECT_TONES = {
  auto: "border-teal-500/50 bg-teal-50/50 dark:bg-teal-900/10 text-teal-700 dark:text-teal-400 font-medium focus:ring-1 focus:ring-teal-500",
  manual:
    "border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:ring-1 focus:ring-indigo-500",
  unmapped:
    "border-red-300 dark:border-red-800 bg-white dark:bg-neutral-950 text-red-600 dark:text-red-400 focus:ring-1 focus:ring-red-500",
};

/** Column-mapping table per the design system's Data Ingestion spec:
    source chip -> arrow -> destination select -> status icon, with teal
    auto-matched rows and red unmapped rows. */
export function ImportMappingGrid(props: ImportMappingGridProps) {
  const { section, headers, rowCount, mapping, autoMatched, onMap } = props;
  const fields = IMPORT_FIELDS[section];
  const used = new Set(Object.values(mapping).filter(Boolean));

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/50 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
        <div>CSV Header (Source)</div>
        <div></div>
        <div>ChronoSolve Field (Destination)</div>
        <div>Status</div>
      </div>

      {headers.map((header, index) => {
        const mapped = mapping[header] !== "";
        const tone = !mapped ? "unmapped" : autoMatched.has(header) ? "auto" : "manual";
        const arrow =
          tone === "auto" ? "text-teal-500" : tone === "manual" ? "text-indigo-500" : "text-red-400";
        return (
          <div
            key={header}
            className={`grid grid-cols-[1fr_auto_1fr_auto] gap-4 px-6 py-3.5 items-center border-b border-neutral-200 dark:border-neutral-800 last:border-b-0 ${
              mapped ? "" : "bg-red-50/30 dark:bg-red-950/10"
            }`}
          >
            <div
              className={`p-2 rounded-md border text-sm font-medium flex items-center gap-2 ${
                mapped
                  ? "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                  : "border-red-200 dark:border-red-900/50 bg-white dark:bg-neutral-900 text-red-600 dark:text-red-400"
              }`}
            >
              <span className="truncate">{header}</span>
              {index === 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                  {rowCount} rows
                </span>
              )}
            </div>
            <ArrowRight size={14} className={arrow} />
            <select
              value={mapping[header]}
              onChange={(event) => onMap(header, event.target.value)}
              className={`w-full text-sm rounded-md px-3 py-2 border focus:outline-none ${SELECT_TONES[tone]}`}
            >
              <option value="">-- Select Destination Field --</option>
              {fields.map((field) => (
                <option
                  key={field.key}
                  value={field.key}
                  disabled={used.has(field.key) && mapping[header] !== field.key}
                >
                  {field.label}
                </option>
              ))}
            </select>
            <div
              className={`flex items-center justify-center ${
                tone === "auto"
                  ? "text-teal-500"
                  : tone === "manual"
                    ? "text-neutral-300 dark:text-neutral-700"
                    : "text-red-500"
              }`}
            >
              {mapped ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
