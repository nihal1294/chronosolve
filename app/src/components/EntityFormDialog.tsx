import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ENTITY_FIELDS, entityToForm, formToEntity, type FormValues } from "../lib/entity-forms";
import type { Entity, EntitySection } from "../lib/problem-doc";
import type { ProblemEntities } from "../lib/entities";
import { EntityFieldInput } from "./EntityFieldInput";

const SECTION_LABEL: Record<EntitySection, string> = {
  subjects: "course",
  teachers: "professor",
  student_groups: "student group",
  rooms: "room",
};

interface EntityFormDialogProps {
  section: EntitySection;
  /** null = create a new entity; otherwise the entity being edited. */
  initial: Entity | null;
  entities: ProblemEntities | null;
  /** Ids already present in the section (duplicate guard in create mode). */
  existingIds: readonly string[];
  onSave: (entity: Entity) => void;
  onClose: () => void;
}

/** Modal add/edit form for one entity; Save maps the inputs back onto the
    problem doc entity (unknown fields survive) and hands it to onSave. */
export function EntityFormDialog(props: EntityFormDialogProps) {
  const { section, initial, entities, existingIds, onSave, onClose } = props;
  const fields = ENTITY_FIELDS[section];
  const [values, setValues] = useState<FormValues>(() => entityToForm(fields, initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editing = initial !== null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const save = () => {
    const result = formToEntity(fields, values, { base: initial, existingIds });
    if (result.entity === null) {
      setErrors(result.errors);
      return;
    }
    onSave(result.entity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold capitalize">
              {editing ? `Edit ${SECTION_LABEL[section]}` : `Add ${SECTION_LABEL[section]}`}
            </h2>
            <p className="text-xs mt-0.5 text-neutral-500 dark:text-neutral-400">
              Saving rewrites the YAML problem definition.
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 dark:text-neutral-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {fields.map((field) => (
            <EntityFieldInput
              key={field.key}
              field={field}
              value={values[field.key]}
              error={errors[field.key]}
              disabled={editing && field.key === "id"}
              entities={entities}
              onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            {editing ? "Save changes" : `Add ${SECTION_LABEL[section]}`}
          </button>
        </div>
      </div>
    </div>
  );
}
