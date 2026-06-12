import { CheckCircle2, Database } from "lucide-react";

const STEPS = ["Upload CSV", "Map Columns", "Validate Constraints"];

/** Wizard progress header: teal check = done, indigo dot = current,
    outlined dot = pending (per the Data Ingestion spec). */
export function WizardStepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const state = number < step ? "done" : number === step ? "current" : "pending";
        return (
          <div key={label} className="flex items-center gap-2">
            {index > 0 && <div className="h-px w-6 bg-neutral-200 dark:bg-neutral-800 mx-1" />}
            <div
              className={`flex items-center gap-2 ${
                state === "done"
                  ? "text-teal-600 dark:text-teal-400"
                  : state === "current"
                    ? "text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {state === "done" ? (
                <CheckCircle2 size={16} />
              ) : (
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    state === "current"
                      ? "bg-indigo-600 text-white font-bold"
                      : "border border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  {number}
                </div>
              )}
              <span className={`text-sm ${state === "pending" ? "" : "font-semibold"}`}>
                {number}. {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface WizardFooterProps {
  step: 1 | 2 | 3;
  /** Labels of required fields not yet mapped (gates the step-2 action). */
  missing: string[];
  validating: boolean;
  onCancel: () => void;
  onValidate: () => void;
  onImport: () => void;
}

/** Footer actions per step: Cancel Import always; Validate gated on the
    required mapping; Import Data applies the staged doc. */
export function WizardFooter({
  step,
  missing,
  validating,
  onCancel,
  onValidate,
  onImport,
}: WizardFooterProps) {
  const blocked = missing.length > 0;
  return (
    <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3 bg-neutral-50 dark:bg-neutral-950/50 rounded-b-2xl">
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        Cancel Import
      </button>
      {step === 2 && (
        <button
          onClick={onValidate}
          disabled={blocked}
          title={blocked ? `Map required fields first: ${missing.join(", ")}` : undefined}
          className={`px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white shadow-sm flex items-center gap-2 transition-colors ${
            blocked ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-700"
          }`}
        >
          Validate Constraints
        </button>
      )}
      {step === 3 && (
        <button
          onClick={onImport}
          disabled={validating}
          className={`px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white shadow-sm flex items-center gap-2 transition-colors ${
            validating ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-700"
          }`}
        >
          <Database size={14} /> Import Data
        </button>
      )}
    </div>
  );
}
