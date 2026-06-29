import { AlertTriangle, XCircle, type LucideIcon } from "lucide-react";
import { useDocValidation } from "../lib/use-doc-validation";
import type { ProblemDoc } from "../lib/problem-doc";

interface IssueListProps {
  icon: LucideIcon;
  title: string;
  items: string[];
  tone: string;
}

/** One tinted block - an icon + heading over the solver's own messages. The
    messages are authored solver-side (validation/*.py), so we render them as-is
    rather than rewording each rule's diagnostic in the UI. */
function IssueList({ icon: Icon, title, items, tone }: IssueListProps) {
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="mb-1.5 flex items-center gap-2">
        <Icon size={16} />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <ul className="ml-6 list-disc space-y-0.5 text-sm">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

const ERROR_TONE =
  "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300";
const WARN_TONE =
  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";

/** Surfaces the solver's pre-solve /validate findings inline, so a structural
    problem - a dangling rule reference (a deleted subject still named in an
    advanced rule), an out-of-range slot, an over-booked break - is caught here
    instead of only when the solve fails. Renders nothing while the doc is clean
    or its validity is still unknown (no doc, or the sidecar is unreachable). */
export function ValidationBanner({ doc }: { doc: ProblemDoc | null }) {
  const report = useDocValidation(doc);
  if (!report) return null;
  const { errors, warnings } = report;
  if (errors.length === 0 && warnings.length === 0) return null;
  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <IssueList icon={XCircle} title="Fix before scheduling" items={errors} tone={ERROR_TONE} />
      )}
      {warnings.length > 0 && (
        <IssueList icon={AlertTriangle} title="Worth a look" items={warnings} tone={WARN_TONE} />
      )}
    </div>
  );
}
