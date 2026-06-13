import { useState, type ComponentType } from "react";
import { Calendar, Download, FileSpreadsheet, FileText } from "lucide-react";
import { saveTextFile, toCsv } from "../lib/export-file";
import type { ScheduleEntry } from "../lib/solver-client";

interface ExportRowSpec {
  icon: ComponentType<{ size?: number }>;
  chip: string;
  title: string;
  caption: string;
  /** Reason this format is unavailable; undefined = live. */
  disabledReason?: string;
}

const PDF_ROW: ExportRowSpec = {
  icon: FileText,
  chip: "bg-red-500/10 text-red-600 dark:text-red-400",
  title: "Master PDF Report",
  caption: "Visual grid for all departments",
  disabledReason: "Planned - needs a report renderer (M4)",
};

const CSV_ROW: ExportRowSpec = {
  icon: FileSpreadsheet,
  chip: "bg-green-500/10 text-green-600 dark:text-green-400",
  title: "Raw Data Extract",
  caption: "CSV format for ERP ingestion",
};

const ICS_ROW: ExportRowSpec = {
  icon: Calendar,
  chip: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  title: "iCal / Outlook Sync",
  caption: "ICS files for individual professors",
  disabledReason: "Planned - problem days carry no calendar dates yet",
};

/** "Publish & Export" card per the MetricsReportingTab spec. Only CSV is
    live; PDF and ICS render disabled with the reason in their tooltip. */
export function ExportCenter({ schedule }: { schedule: ScheduleEntry[] }) {
  const [note, setNote] = useState<string | null>(null);

  const exportCsv = async () => {
    try {
      const saved = await saveTextFile("schedule.csv", toCsv(schedule));
      setNote(saved ? "CSV saved." : null);
    } catch (problem) {
      setNote(`Export failed: ${problem instanceof Error ? problem.message : String(problem)}`);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 flex flex-col">
      <h3 className="text-sm font-semibold mb-2">Publish & Export</h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">
        Distribute the optimized schedule to university systems.
      </p>
      <div className="space-y-3 flex-1">
        <ExportRow spec={PDF_ROW} />
        <ExportRow spec={CSV_ROW} onRun={exportCsv} />
        <ExportRow spec={ICS_ROW} />
      </div>
      {note && <p className="text-xs mt-3 text-neutral-500 dark:text-neutral-400">{note}</p>}
    </div>
  );
}

function ExportRow({ spec, onRun }: { spec: ExportRowSpec; onRun?: () => void }) {
  const Icon = spec.icon;
  const disabled = spec.disabledReason !== undefined;
  return (
    <button
      onClick={onRun}
      disabled={disabled}
      title={spec.disabledReason}
      className={`w-full p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center justify-between group transition-colors ${
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded ${spec.chip}`}>
          <Icon size={16} />
        </div>
        <div className="text-left">
          <div className="text-sm font-medium">{spec.title}</div>
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400">{spec.caption}</div>
        </div>
      </div>
      <Download
        size={16}
        className="text-neutral-500 dark:text-neutral-400 group-hover:text-indigo-500 transition-colors"
      />
    </button>
  );
}
