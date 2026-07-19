import type { RoomOption } from "../lib/room-eligibility";

interface RoomPickerProps {
  /** Current room of the selected entry (null = none assigned). */
  value: string | null;
  options: RoomOption[];
  nameOf: (roomId: string) => string;
  onChange: (roomId: string) => void;
}

/** Native room selector for the Session panel: every doc room in doc order,
    ineligible ones disabled with the failing rule as suffix - the picker
    makes incompatible rooms unrepresentable while teaching the rule.
    Renders nothing when the doc defines no rooms. */
export function RoomPicker({ value, options, nameOf, onChange }: RoomPickerProps) {
  if (options.length === 0) return null;
  const known = value === null || options.some((option) => option.roomId === value);
  return (
    <select
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Room"
      className="max-w-44 rounded-md border border-neutral-200 bg-transparent py-1 pl-2 pr-6 text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-neutral-800 dark:text-neutral-200"
    >
      {value === null && (
        <option value="" disabled>
          No room assigned
        </option>
      )}
      {!known && value !== null && (
        <option value={value} disabled>
          {nameOf(value)} - unknown room
        </option>
      )}
      {options.map((option) => (
        <option key={option.roomId} value={option.roomId} disabled={!option.eligible}>
          {nameOf(option.roomId)}
          {option.reason ? ` - ${option.reason}` : ""}
        </option>
      ))}
    </select>
  );
}
