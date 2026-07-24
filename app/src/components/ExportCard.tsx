import { useState, type ComponentType } from "react";
import { Calendar, Download, FileSpreadsheet, FileText } from "lucide-react";
import { saveTextFile, toCsv } from "../lib/export-file";
import { buildIcs, icsSessionsFor } from "../lib/ics-export";
import { PrintReport } from "./PrintReport";
import type { ProblemEntities } from "../lib/entities";
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
  caption: "Save one grid per class as PDF",
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
  caption: "Weekly events for a teacher or class (12 weeks)",
};

interface ExportCardProps {
  schedule: ScheduleEntry[];
  entities: ProblemEntities | null;
  subjectNames: Map<string, string>;
  roomNames: Map<string, string>;
}

/** One pickable calendar scope: a teacher or a student group. */
interface IcsScope {
  kind: "teacher" | "group";
  id: string;
  name: string;
}

const icsScopes = (entities: ProblemEntities): IcsScope[] => [
  ...entities.teachers.map((t): IcsScope => ({ kind: "teacher", id: t.id, name: t.name })),
  ...entities.groups.map((g): IcsScope => ({ kind: "group", id: g.id, name: g.name })),
];

const fileSlug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Publish & export card. CSV and ICS save through the native dialog (ICS
    expands a scope picker first); PDF opens the OS print dialog directly over
    a hidden print-only report. */
export function ExportCard({ schedule, entities, subjectNames, roomNames }: ExportCardProps) {
  const [note, setNote] = useState<string | null>(null);
  const [pickingIcs, setPickingIcs] = useState(false);
  const [printSignal, setPrintSignal] = useState(0);

  const report = (message: string) => setNote(message);
  const failed = (problem: unknown) =>
    report(`Export failed: ${problem instanceof Error ? problem.message : String(problem)}`);

  const exportCsv = async () => {
    try {
      const saved = await saveTextFile("schedule.csv", toCsv(schedule));
      report(saved ? "CSV saved." : "");
    } catch (problem) {
      failed(problem);
    }
  };

  const exportIcs = async (scope: IcsScope) => {
    setPickingIcs(false);
    try {
      const { ics, skipped } = buildIcs(icsSessionsFor(schedule, scope.kind, scope.id), {
        from: new Date(),
        labels: entities?.slotLabels ?? {},
        subjectName: (id) => subjectNames.get(id) ?? id,
        roomName: (id) => (id === null ? "" : (roomNames.get(id) ?? id)),
      });
      const saved = await saveTextFile(`${fileSlug(scope.name)}.ics`, ics);
      const skipNote = skipped.length > 0 ? ` (skipped unknown days: ${skipped.join(", ")})` : "";
      report(saved ? `Calendar for ${scope.name} saved.${skipNote}` : "");
    } catch (problem) {
      failed(problem);
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
        <ExportRow
          spec={entities ? PDF_ROW : { ...PDF_ROW, disabledReason: "Load a problem to build the report" }}
          onRun={() => setPrintSignal((tick) => tick + 1)}
        />
        <ExportRow
          spec={
            entities ? ICS_ROW : { ...ICS_ROW, disabledReason: "Load a problem to pick a calendar scope" }
          }
          onRun={() => setPickingIcs((was) => !was)}
        />
        {pickingIcs && entities && (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
            {icsScopes(entities).map((scope) => (
              <button
                key={`${scope.kind}|${scope.id}`}
                onClick={() => exportIcs(scope)}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span>{scope.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-400">
                  {scope.kind === "teacher" ? "Teacher" : "Class"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {note && <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">{note}</p>}
      {printSignal > 0 && entities && (
        <PrintReport
          schedule={schedule}
          entities={entities}
          subjectNames={subjectNames}
          roomNames={roomNames}
          printSignal={printSignal}
          onProblem={(message) => report(`Export failed: ${message}`)}
        />
      )}
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
