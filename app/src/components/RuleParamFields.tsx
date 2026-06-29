import { useState } from "react";
import { formatTags, parseTags } from "../lib/rule-format";

/** The leaf widgets a rule param form is built from (dropdowns, toggle chips,
    the tag input, the number input). The dispatcher that picks one per ParamDef
    lives in RuleParamForm.tsx; these stay here to keep that file focused. */

export type Option = { value: string; label: string };

const labelCls = "block text-xs font-medium text-neutral-600 dark:text-neutral-400";
const inputCls =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-neutral-700";

export function Select({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <label className={labelCls}>
      {label}
      <select className={inputCls} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          Select…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ChipToggle({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: unknown;
  onChange: (v: string[]) => void;
}) {
  const selected = (Array.isArray(value) ? value : []) as string[];
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            on={selected.includes(o.value)}
            onClick={() => toggle(o.value)}
          />
        ))}
      </div>
    </div>
  );
}

export function SlotChips({
  label,
  count,
  value,
  onChange,
}: {
  label: string;
  count: number;
  value: unknown;
  onChange: (v: number[]) => void;
}) {
  const selected = (Array.isArray(value) ? value : []) as number[];
  const toggle = (n: number) =>
    onChange(selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n].sort((a, b) => a - b));
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
          <Chip key={n} label={String(n)} on={selected.includes(n)} onClick={() => toggle(n)} />
        ))}
      </div>
    </div>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
        on
          ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          : "border-neutral-300 text-neutral-500 hover:text-neutral-800 dark:border-neutral-700 dark:hover:text-neutral-200"
      }`}
    >
      {label}
    </button>
  );
}

export function TagsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className={labelCls}>
      {label}
      <input
        className={inputCls}
        value={draft ?? formatTags(value)}
        placeholder="e.g. gpu, projector"
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(parseTags(e.target.value));
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className={labelCls}>
      {label}
      <input
        type="number"
        min={1}
        className={inputCls}
        value={draft ?? (value == null ? "" : String(value))}
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value.trim() !== "") onChange(Math.max(1, Math.round(Number(e.target.value))));
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}
