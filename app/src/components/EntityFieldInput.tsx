import type { EntityField, FormValues } from "../lib/entity-forms";
import type { ProblemEntities } from "../lib/entities";

export const INPUT_CLASS =
  "w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50";

interface EntityFieldInputProps {
  field: EntityField;
  value: FormValues[string];
  error?: string;
  /** The id field is immutable while editing (it is the upsert key). */
  disabled?: boolean;
  /** Source of idList options and of the days for the unavailable editor. */
  entities: ProblemEntities | null;
  onChange: (value: FormValues[string]) => void;
}

function IdListInput({ field, value, entities, onChange }: EntityFieldInputProps) {
  const pool = field.optionsFrom === "teachers" ? (entities?.teachers ?? []) : (entities?.groups ?? []);
  const checked = Array.isArray(value) ? value : [];
  if (pool.length === 0) {
    return (
      <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
        Nothing to pick from yet - add {field.optionsFrom} first.
      </p>
    );
  }
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...checked, id] : checked.filter((item) => item !== id));
  return (
    <div className="max-h-36 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-800 p-2 flex flex-col gap-1.5">
      {pool.map((option) => (
        <label key={option.id} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="accent-indigo-600"
            checked={checked.includes(option.id)}
            onChange={(event) => toggle(option.id, event.target.checked)}
          />
          <span className="font-mono text-xs">{option.id}</span>
          <span className="text-neutral-500 dark:text-neutral-400 truncate">{option.name}</span>
        </label>
      ))}
    </div>
  );
}

function UnavailableInput({ value, entities, onChange }: EntityFieldInputProps) {
  const days = entities?.days ?? [];
  const map = typeof value === "object" && !Array.isArray(value) ? value : {};
  if (days.length === 0) {
    return (
      <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
        Define time_structure.days in the editor first.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {days.map((day) => (
        <div key={day} className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{day}</span>
          <input
            type="text"
            value={map[day] ?? ""}
            placeholder="e.g. 1, 2"
            onChange={(event) => onChange({ ...map, [day]: event.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      ))}
    </div>
  );
}

/** One labelled form row, rendered per the field's kind. */
export function EntityFieldInput(props: EntityFieldInputProps) {
  const { field, value, error, disabled, onChange } = props;
  const text = typeof value === "string" ? value : "";
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {field.label}
        {field.required && <span className="text-neutral-400 dark:text-neutral-500"> *</span>}
      </label>
      {field.kind === "idList" ? (
        <IdListInput {...props} />
      ) : field.kind === "unavailable" ? (
        <UnavailableInput {...props} />
      ) : field.kind === "select" ? (
        <select
          value={text}
          onChange={(event) => onChange(event.target.value)}
          className={`${INPUT_CLASS} dark:bg-neutral-900`}
        >
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option === "" ? "(none)" : option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          inputMode={field.kind === "int" ? "numeric" : undefined}
          value={text}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={INPUT_CLASS}
        />
      )}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
      ) : (
        field.help && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{field.help}</p>
      )}
    </div>
  );
}
