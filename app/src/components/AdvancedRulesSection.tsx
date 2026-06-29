import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { parseEntities } from "../lib/entities";
import { buildNameMaps } from "../lib/rule-format";
import { getSoftWeight, setSoftWeight, type ProblemDoc } from "../lib/problem-doc";
import { RULE_TEMPLATES, type RuleTemplate } from "../lib/rule-templates";
import { AddRuleMenu } from "./AddRuleMenu";
import { AdvancedRuleCard } from "./AdvancedRuleCard";
import { RuleParamForm } from "./RuleParamForm";

const card =
  "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm";

type Params = Record<string, unknown>;
type Draft = { template: RuleTemplate; params: Params };

const isFilled = (v: unknown) =>
  v !== undefined && v !== null && v !== "" && (!Array.isArray(v) || v.length > 0);

/** The "Advanced rules" surface: author the 12 M7.1 rules and list those already
    set. Cards are derive()d from the doc (Option 1), so deleting/importance flows
    straight back into the canonical config via onEdit. */
export function AdvancedRulesSection({
  doc,
  onEdit,
}: {
  doc: ProblemDoc;
  onEdit: (next: ProblemDoc) => void;
}) {
  const entities = useMemo(() => parseEntities(doc), [doc]);
  const names = useMemo(() => buildNameMaps(entities), [entities]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const cards = RULE_TEMPLATES.flatMap((template) =>
    template.derive(doc).map((instance, index) => ({ template, instance, index })),
  );

  const ready = draft !== null && draft.template.params.every((p) => isFilled(draft.params[p.key]));
  const commit = () => {
    if (!draft || !ready) return;
    onEdit(draft.template.serialize({ templateId: draft.template.id, params: draft.params }, doc));
    setDraft(null);
  };

  return (
    <section className="space-y-4" data-tour="constraints-advanced">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-indigo-500" />
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Advanced rules</h2>
        </div>
        <AddRuleMenu onPick={(template) => setDraft({ template, params: {} })} />
      </div>

      {draft && (
        <div className={`${card} space-y-4 p-5`}>
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {draft.template.label}
          </div>
          <RuleParamForm
            params={draft.template.params}
            value={draft.params}
            entities={entities}
            onChange={(params) => setDraft({ ...draft, params })}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={!ready}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
            >
              Add rule
            </button>
          </div>
        </div>
      )}

      {cards.length === 0 && !draft ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No advanced rules yet. Use “Add rule” to set breaks, room tags, sequencing, and more.
        </p>
      ) : (
        <div className="space-y-3">
          {cards.map(({ template, instance, index }) => {
            const wk = template.weightKey;
            return (
              <AdvancedRuleCard
                key={`${template.id}-${index}`}
                template={template}
                instance={instance}
                names={names}
                weight={wk ? getSoftWeight(doc, wk) : undefined}
                onWeightChange={wk ? (w) => onEdit(setSoftWeight(doc, wk, w)) : undefined}
                onDelete={() => onEdit(template.remove(doc, index))}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
