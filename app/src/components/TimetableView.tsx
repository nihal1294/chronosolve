import { Lock } from "lucide-react";
import type { ScheduleEntry } from "../lib/solver-client";
import { pivotByGroup } from "../lib/grid";
import { BrandLogo } from "./BrandLogo";

/* Grid blocks follow the design system's Timeline Blocks spec: tinted body,
   absolute w-1 accent strip, hue-encoded STATE — teal for standard
   placements, indigo + Lock for pre-assigned ("Locked / Hard Constrained"). */
const HUES = {
  teal: {
    box: "bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/20 hover:ring-1 hover:ring-teal-500",
    strip: "bg-teal-500",
    code: "text-teal-700 dark:text-teal-400",
    meta: "text-teal-600/80 dark:text-teal-500/80",
    selected: "shadow-[inset_0_0_0_2px_#14b8a6]",
  },
  indigo: {
    box: "bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 hover:ring-1 hover:ring-indigo-500",
    strip: "bg-indigo-500",
    code: "text-indigo-700 dark:text-indigo-400",
    meta: "text-indigo-600/80 dark:text-indigo-500/80",
    selected: "shadow-[inset_0_0_0_2px_#6366f1]",
  },
};

interface TimetableViewProps {
  schedule: ScheduleEntry[];
  days: string[];
  slotCount: number;
  slotLabels: Record<number, string>;
  subjectNames: Map<string, string>;
  /** "subject|day|slot" keys of pre-assigned sessions (locked blocks). */
  lockedKeys: Set<string>;
  selected: ScheduleEntry | null;
  onSelect: (entry: ScheduleEntry) => void;
}

/** Centered brand empty state shown before any solve has produced a schedule. */
function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12 text-center">
      <BrandLogo variant="primary" size={96} animated />
      <h2 className="text-xl font-medium">Ready to Solve</h2>
      <p className="text-sm max-w-sm text-neutral-500 dark:text-neutral-400">
        Load a problem definition, then run the solver to see the optimized timetable here.
      </p>
    </div>
  );
}

function SessionBlock({ entry, locked, slotLabel, name, isSelected, onSelect }: {
  entry: ScheduleEntry;
  locked: boolean;
  slotLabel: string | undefined;
  name: string;
  isSelected: boolean;
  onSelect: (entry: ScheduleEntry) => void;
}) {
  const hue = locked ? HUES.indigo : HUES.teal;
  const meta = [entry.room_id, slotLabel].filter(Boolean).join(" • ");
  return (
    <button
      onClick={() => onSelect(entry)}
      title={name}
      className={`relative w-full h-full text-left rounded-lg border p-2 transition-all ${hue.box} ${
        isSelected ? hue.selected : ""
      }`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${hue.strip}`} />
      {locked && <Lock size={12} className="absolute top-2 right-2 text-indigo-500/70" />}
      <div className={`text-[10px] font-bold ${hue.code}`}>{entry.subject_id}</div>
      {meta && <div className={`text-[9px] mt-0.5 truncate ${hue.meta}`}>{meta}</div>}
    </button>
  );
}

/** One weekly grid per student group; click a session block to inspect it. */
export function TimetableView({ schedule, days, slotCount, slotLabels, subjectNames, lockedKeys, selected, onSelect }: TimetableViewProps) {
  if (schedule.length === 0) return <EmptyState />;
  const grid = pivotByGroup(schedule);
  const dayList = days.length > 0 ? days : [...new Set(schedule.map((entry) => entry.day))];
  const maxSlot = Math.max(slotCount, ...schedule.map((entry) => entry.slot));
  const slots = Array.from({ length: maxSlot }, (_, index) => index + 1);

  return (
    <div className="flex-1 p-6 space-y-10 min-h-0 overflow-auto">
      {[...grid.entries()].map(([groupId, dayMap]) => (
        <table key={groupId} className="w-full border-separate border-spacing-1.5">
          <caption className="pb-2 text-left text-lg font-medium">{groupId}</caption>
          <thead>
            <tr>
              <th className="w-20 pb-1 text-right pr-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Slot
              </th>
              {dayList.map((day) => (
                <th key={day} className="pb-1 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot}>
                <td className="pr-2 text-right align-middle font-mono text-[10px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                  {slotLabels[slot] ?? slot}
                </td>
                {dayList.map((day) => {
                  const entry = dayMap.get(day)?.get(slot);
                  return (
                    <td key={day} className="h-16 align-middle">
                      {entry ? (
                        <SessionBlock
                          entry={entry}
                          locked={lockedKeys.has(`${entry.subject_id}|${entry.day}|${entry.slot}`)}
                          slotLabel={slotLabels[slot]}
                          name={subjectNames.get(entry.subject_id) ?? entry.subject_id}
                          isSelected={selected === entry}
                          onSelect={onSelect}
                        />
                      ) : (
                        <div className="h-full rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
