import { useState } from "react";
import Papa from "papaparse";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, X } from "lucide-react";
import { applyMapping, autoMatch, missingRequired } from "../lib/csv-import";
import { upsertEntity, type Entity, type EntitySection, type ProblemDoc } from "../lib/problem-doc";
import { solverClient, type ValidationReport } from "../lib/solver-client";
import { INPUT_CLASS } from "./EntityFieldInput";
import { ImportMappingGrid } from "./ImportMappingGrid";
import { WizardFooter, WizardStepper } from "./ImportWizardChrome";

const SECTIONS: { value: EntitySection; label: string }[] = [
  { value: "subjects", label: "Courses" },
  { value: "teachers", label: "Professors" },
  { value: "student_groups", label: "Student Groups" },
  { value: "rooms", label: "Rooms" },
];

interface ParsedCsv {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
}

interface StagedImport {
  next: ProblemDoc;
  imported: Entity[];
  rowErrors: string[];
  report: ValidationReport | null; // null while the sidecar call is in flight
}

interface ImportWizardProps {
  doc: ProblemDoc | null;
  onApply: (next: ProblemDoc) => void;
  onClose: () => void;
}

/** Three-step CSV import per the design system's Data Ingestion & Mapping
    spec: Upload -> Map Columns -> Validate Constraints. */
export function ImportWizard({ doc, onApply, onClose }: ImportWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [section, setSection] = useState<EntitySection>("subjects");
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [autoMatched, setAutoMatched] = useState<ReadonlySet<string>>(new Set());
  const [staged, setStaged] = useState<StagedImport | null>(null);

  const onFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        const proposed = autoMatch(headers, section);
        setCsv({ fileName: file.name, headers, rows: result.data });
        setMapping(proposed);
        setAutoMatched(new Set(headers.filter((header) => proposed[header] !== "")));
        setStep(2);
      },
    });
  };

  const missing = missingRequired(mapping, section);

  const runValidation = async () => {
    if (!csv) return;
    const converted = applyMapping(csv.rows, mapping, section);
    let next: ProblemDoc = { ...(doc ?? {}) };
    for (const entity of converted.entities) next = upsertEntity(next, section, entity);
    setStaged({ next, imported: converted.entities, rowErrors: converted.errors, report: null });
    setStep(3);
    try {
      const report = await solverClient.validate(next);
      setStaged((current) => current && { ...current, report });
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : String(problem);
      const report = { errors: [`Validation request failed: ${message}`], warnings: [] };
      setStaged((current) => current && { ...current, report });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 duration-200">
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
          <WizardStepper step={step} />
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 dark:text-neutral-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {step === 1 && (
          <div className="px-6 pb-6 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Import as</label>
              <select
                value={section}
                onChange={(event) => setSection(event.target.value as EntitySection)}
                className={`${INPUT_CLASS} dark:bg-neutral-900`}
              >
                {SECTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">CSV file</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])}
                className="block w-full text-sm text-neutral-500 dark:text-neutral-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-indigo-600 file:text-white file:text-sm file:font-medium hover:file:bg-indigo-700 file:transition-colors"
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
                First row must be column headers — they are auto-matched to ChronoSolve fields next.
              </p>
            </div>
          </div>
        )}

        {step === 2 && csv && (
          <div className="border-t border-neutral-200 dark:border-neutral-800">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/20">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-sm font-semibold truncate">Mapping: {csv.fileName}</span>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 font-medium whitespace-nowrap">
                {missing.length === 0
                  ? "All required fields mapped"
                  : `${missing.length} required field${missing.length > 1 ? "s" : ""} unmapped`}
              </span>
            </div>
            <ImportMappingGrid
              section={section}
              headers={csv.headers}
              rowCount={csv.rows.length}
              mapping={mapping}
              autoMatched={autoMatched}
              onMap={(header, key) => setMapping((current) => ({ ...current, [header]: key }))}
            />
          </div>
        )}

        {step === 3 && staged && <ValidationSummary staged={staged} />}

        <WizardFooter
          step={step}
          missing={missing}
          validating={step === 3 && staged?.report === null}
          onCancel={onClose}
          onValidate={runValidation}
          onImport={() => {
            if (staged) onApply(staged.next);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

function ValidationSummary({ staged }: { staged: StagedImport }) {
  const { imported, rowErrors, report } = staged;
  return (
    <div className="px-6 py-5 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-2 text-sm">
      <p>
        <span className="font-semibold">{imported.length}</span> row{imported.length === 1 ? "" : "s"}{" "}
        converted{rowErrors.length > 0 && `, ${rowErrors.length} skipped`}.
      </p>
      {report === null ? (
        <p className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
          <Loader2 size={14} className="animate-spin" /> Validating against the solver…
        </p>
      ) : (
        [...rowErrors, ...report.errors].map((message) => <Issue key={message} message={message} error />)
      )}
      {report?.warnings.map((message) => (
        <Issue key={message} message={message} />
      ))}
      {report !== null && report.errors.length === 0 && rowErrors.length === 0 && (
        <p className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-medium">
          <CheckCircle2 size={14} /> No validation issues — ready to import.
        </p>
      )}
    </div>
  );
}

function Issue({ message, error = false }: { message: string; error?: boolean }) {
  const tone = error ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400";
  return (
    <p className={`flex items-start gap-2 text-xs ${tone}`}>
      <AlertCircle size={14} className="shrink-0 mt-0.5" /> {message}
    </p>
  );
}
