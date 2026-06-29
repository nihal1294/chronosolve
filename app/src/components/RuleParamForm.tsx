import type { ProblemEntities } from "../lib/entities";
import type { ParamDef } from "../lib/rule-templates";
import { ChipToggle, NumberField, Select, SlotChips, TagsField, type Option } from "./RuleParamFields";

type Params = Record<string, unknown>;

const entityOpts = (rows: { id: string; name: string }[]): Option[] =>
  rows.map((r) => ({ value: r.id, label: r.name }));
const stringOpts = (xs: string[]): Option[] => xs.map((x) => ({ value: x, label: x }));

/** A param form generated from a template's ParamDef[]. Each field writes its key
    back into the params object; entity refs become dropdowns, slots/subjects become
    toggle chips, tags a comma-separated input. */
export function RuleParamForm({
  params,
  value,
  onChange,
  entities,
}: {
  params: ParamDef[];
  value: Params;
  onChange: (next: Params) => void;
  entities: ProblemEntities;
}) {
  const set = (key: string, v: unknown) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-3">
      {params.map((param) => (
        <Field
          key={param.key}
          param={param}
          value={value[param.key]}
          entities={entities}
          onChange={(v) => set(param.key, v)}
        />
      ))}
    </div>
  );
}

function Field({
  param,
  value,
  entities,
  onChange,
}: {
  param: ParamDef;
  value: unknown;
  entities: ProblemEntities;
  onChange: (v: unknown) => void;
}) {
  const { label } = param;
  switch (param.kind) {
    case "subject":
      return (
        <Select label={label} options={entityOpts(entities.subjects)} value={value} onChange={onChange} />
      );
    case "teacher":
      return (
        <Select label={label} options={entityOpts(entities.teachers)} value={value} onChange={onChange} />
      );
    case "group":
      return <Select label={label} options={entityOpts(entities.groups)} value={value} onChange={onChange} />;
    case "room":
      return <Select label={label} options={entityOpts(entities.rooms)} value={value} onChange={onChange} />;
    case "day":
      return <Select label={label} options={stringOpts(entities.days)} value={value} onChange={onChange} />;
    case "half":
      return (
        <Select
          label={label}
          options={stringOpts(["morning", "afternoon"])}
          value={value}
          onChange={onChange}
        />
      );
    case "subjects":
      return (
        <ChipToggle label={label} options={entityOpts(entities.subjects)} value={value} onChange={onChange} />
      );
    case "slots":
      return <SlotChips label={label} count={entities.slotsPerDay} value={value} onChange={onChange} />;
    case "tags":
      return <TagsField label={label} value={value} onChange={onChange} />;
    case "number":
      return <NumberField label={label} value={value} onChange={onChange} />;
    default:
      return null;
  }
}
