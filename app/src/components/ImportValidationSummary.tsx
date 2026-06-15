import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ValidationReport } from "../lib/solver-client";

interface ImportValidationSummaryProps {
  /** Count of CSV rows successfully converted into entities. */
  imported: number;
  /** Per-row conversion failures (those rows were skipped). */
  rowErrors: string[];
  /** Solver preflight result; null while the request is in flight. */
  report: ValidationReport | null;
}

/** Step-3 body: row conversion outcome plus the solver's validation
    preflight. The preflight is informational - importing stays allowed so a
    partial file (e.g. courses before professors) can bootstrap a problem. */
export function ImportValidationSummary({ imported, rowErrors, report }: ImportValidationSummaryProps) {
  const errors = report === null ? [] : [...rowErrors, ...report.errors];
  return (
    <div className="px-6 py-5 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-2 text-sm">
      <p>
        <span className="font-semibold">{imported}</span> row{imported === 1 ? "" : "s"} converted
        {rowErrors.length > 0 && `, ${rowErrors.length} skipped`}.
      </p>
      {report === null ? (
        <p className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
          <Loader2 size={14} className="animate-spin" /> Validating against the scheduler…
        </p>
      ) : (
        errors.map((message, index) => <Issue key={index} message={message} error />)
      )}
      {report?.warnings.map((message, index) => (
        <Issue key={index} message={message} />
      ))}
      {report !== null && errors.length === 0 && (
        <p className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-medium">
          <CheckCircle2 size={14} /> No validation issues - ready to import.
        </p>
      )}
      {report !== null && errors.length > 0 && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          You can still import - cross-reference errors usually resolve once the related CSVs (professors,
          groups, rooms) are imported too.
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
