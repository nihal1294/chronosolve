import type { ScheduleEntry } from "../lib/solver-client";
import { scheduleKey } from "../lib/grid";

/* Block hues mirror the design system's Timeline spec: teal = standard
   placement, indigo + lock = pre-assigned. */
const HUE = {
  teal: {
    box: "bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/20",
    strip: "bg-teal-500",
    code: "text-teal-700 dark:text-teal-400",
    meta: "text-teal-600/80 dark:text-teal-500/80",
    ring: "ring-2 ring-teal-500",
  },
  indigo: {
    box: "bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20",
    strip: "bg-indigo-500",
    code: "text-indigo-700 dark:text-indigo-400",
    meta: "text-indigo-600/80 dark:text-indigo-500/80",
    ring: "ring-2 ring-indigo-500",
  },
};

interface WeeklyGridProps {
  title: string;
  subtitle?: string;
  sessions: ScheduleEntry[];
  days: string[];
  slots: number[];
  slotLabels: Record<number, string>;
  /** "subject|day|slot" keys of pinned sessions. */
  lockedKeys: Set<string>;
  selected: ScheduleEntry | null;
  /** Second line on each block (room, groups, ...), chosen by the route. */
  secondary: (entry: ScheduleEntry) => string;
  onSelect: (entry: ScheduleEntry) => void;
  onContextMenu: (event: React.MouseEvent, entry: ScheduleEntry) => void;
}

function Block({
  entry,
  locked,
  secondary,
  selected,
  onSelect,
  onContextMenu,
}: {
  entry: ScheduleEntry;
  locked: boolean;
  secondary: string;
  selected: boolean;
  onSelect: (entry: ScheduleEntry) => void;
  onContextMenu: (event: React.MouseEvent, entry: ScheduleEntry) => void;
}) {
  const hue = locked ? HUE.indigo : HUE.teal;
  return (
    <button
      onClick={() => onSelect(entry)}
      onContextMenu={(event) => onContextMenu(event, entry)}
      className={`relative w-full rounded-md border px-2 py-1 text-left transition-all ${hue.box} ${selected ? hue.ring : ""}`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${hue.strip}`} />
      <div className={`text-[10px] font-bold leading-tight ${hue.code}`}>{entry.subject_id}</div>
      {secondary && <div className={`truncate text-[9px] leading-tight ${hue.meta}`}>{secondary}</div>}
    </button>
  );
}

/** One weekly grid (day x slot). Cells stack every session at that time, so a
    per-entity grid shows one block per cell and the Master grid shows many. */
export function WeeklyGrid({
  title,
  subtitle,
  sessions,
  days,
  slots,
  slotLabels,
  lockedKeys,
  selected,
  secondary,
  onSelect,
  onContextMenu,
}: WeeklyGridProps) {
  const cell = new Map<string, ScheduleEntry[]>();
  for (const entry of sessions) {
    const key = `${entry.day}|${entry.slot}`;
    cell.set(key, [...(cell.get(key) ?? []), entry]);
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
        {subtitle && <span className="text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</span>}
      </div>
      <table className="w-full border-separate border-spacing-1.5">
        <thead>
          <tr>
            <th className="w-24 pb-1 pr-2 text-right text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Slot
            </th>
            {days.map((day) => (
              <th
                key={day}
                className="pb-1 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400"
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot}>
              <td className="whitespace-nowrap pr-2 text-right align-top font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                {slotLabels[slot] ?? slot}
              </td>
              {days.map((day) => {
                const entries = cell.get(`${day}|${slot}`) ?? [];
                return (
                  <td key={day} className="align-top">
                    {entries.length === 0 ? (
                      <div className="h-10 rounded-md border border-dashed border-neutral-200 dark:border-neutral-800" />
                    ) : (
                      <div className="flex min-h-10 flex-col gap-1">
                        {entries.map((entry, index) => (
                          <Block
                            key={`${entry.subject_id}|${entry.room_id}|${index}`}
                            entry={entry}
                            locked={lockedKeys.has(scheduleKey(entry.subject_id, entry.day, entry.slot))}
                            secondary={secondary(entry)}
                            selected={selected === entry}
                            onSelect={onSelect}
                            onContextMenu={onContextMenu}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
