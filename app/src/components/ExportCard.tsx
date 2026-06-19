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
  title: "Master PDF report",
  caption: "Printable grid for all groups",
  disabledReason: "Planned - needs a report renderer",
};

const CSV_ROW: ExportRowSpec = {
  icon: FileSpreadsheet,
  chip: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  title: "CSV data extract",
  caption: "Flat schedule rows for spreadsheets or imports",
};

const ICS_ROW: ExportRowSpec = {
  icon: Calendar,
  chip: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  title: "iCal / calendar sync",
  caption: "ICS per teacher or group",
  disabledReason: "Planned - sessions carry no calendar dates yet",
};

/** Publish & export card. Only CSV is live; PDF and ICS render disabled with
    the reason in their tooltip. */
export function ExportCard({ schedule }: { schedule: ScheduleEntry[] }) {
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
    <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-1 text-sm font-semibold">Export</h3>
      <p className="mb-5 text-xs text-neutral-500 dark:text-neutral-400">
        Share the generated timetable with other tools.
      </p>
      <div className="space-y-3">
        <ExportRow spec={CSV_ROW} onRun={exportCsv} />
        <ExportRow spec={PDF_ROW} />
        <ExportRow spec={ICS_ROW} />
      </div>
      {note && <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">{note}</p>}
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
      className={`group flex w-full items-center justify-between rounded-lg border border-neutral-200 p-3 transition-colors dark:border-neutral-800 ${
        disabled ? "cursor-not-allowed opacity-50" : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`rounded p-2 ${spec.chip}`}>
          <Icon size={16} />
        </div>
        <div className="text-left">
          <div className="text-sm font-medium">{spec.title}</div>
          <div className="text-[10px] text-neutral-500 dark:text-neutral-400">{spec.caption}</div>
        </div>
      </div>
      <Download
        size={16}
        className="text-neutral-500 transition-colors group-hover:text-indigo-500 dark:text-neutral-400"
      />
    </button>
  );
}
