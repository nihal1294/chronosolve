import { useDrop } from "react-dnd";
import type { ScheduleEntry } from "../lib/solver-client";
import { scheduleKey } from "../lib/grid";
import { canDropSession, SESSION_DND_TYPE, type DragItem } from "../lib/drag-rules";
import { SessionBlock } from "./SessionBlock";

interface WeeklyGridProps {
  title: string;
  subtitle?: string;
  sessions: ScheduleEntry[];
  days: string[];
  slots: number[];
  slotLabels: Record<number, string>;
  /** "subject|day|slot" keys of pinned sessions. */
  lockedKeys: Set<string>;
  /** "subject|day|slot" keys of entries the conflict checker flagged. */
  conflictKeys: Set<string>;
  selected: ScheduleEntry | null;
  /** Second line on each block (room, groups, ...), chosen by the route. */
  secondary: (entry: ScheduleEntry) => string;
  /** Block geometry for dragging `entry`, or null when it cannot move. */
  dragSpec: (entry: ScheduleEntry) => DragItem | null;
  onMove: (item: DragItem, day: string, slot: number) => void;
  onSelect: (entry: ScheduleEntry) => void;
  onContextMenu: (event: React.MouseEvent, entry: ScheduleEntry) => void;
}

/** Drop target wrapping one (day, slot) cell. Legal hover targets highlight;
    legality is geometric only (canDropSession) - conflicts never block. */
function CellDrop({
  day,
  slot,
  maxSlot,
  onMove,
  children,
}: {
  day: string;
  slot: number;
  maxSlot: number;
  onMove: (item: DragItem, day: string, slot: number) => void;
  children: React.ReactNode;
}) {
  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: SESSION_DND_TYPE,
      canDrop: (item: DragItem) => canDropSession(item, day, slot, maxSlot),
      drop: (item: DragItem) => onMove(item, day, slot),
      collect: (monitor) => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
    }),
    [day, slot, maxSlot, onMove],
  );
  return (
    <div
      ref={(node) => void drop(node)}
      className={`rounded-md transition-colors ${isOver && canDrop ? "bg-indigo-500/10 ring-1 ring-indigo-400" : ""}`}
    >
      {children}
    </div>
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
  conflictKeys,
  selected,
  secondary,
  dragSpec,
  onMove,
  onSelect,
  onContextMenu,
}: WeeklyGridProps) {
  const maxSlot = slots.length > 0 ? slots[slots.length - 1] : 0;
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
                    <CellDrop day={day} slot={slot} maxSlot={maxSlot} onMove={onMove}>
                      {entries.length === 0 ? (
                        <div className="h-10 rounded-md border border-dashed border-neutral-200 dark:border-neutral-800" />
                      ) : (
                        <div className="flex min-h-10 flex-col gap-1">
                          {entries.map((entry, index) => (
                            <SessionBlock
                              key={`${entry.subject_id}|${entry.room_id}|${index}`}
                              entry={entry}
                              locked={lockedKeys.has(scheduleKey(entry.subject_id, entry.day, entry.slot))}
                              conflicted={conflictKeys.has(
                                scheduleKey(entry.subject_id, entry.day, entry.slot),
                              )}
                              secondary={secondary(entry)}
                              selected={selected === entry}
                              dragItem={dragSpec(entry)}
                              onSelect={onSelect}
                              onContextMenu={onContextMenu}
                            />
                          ))}
                        </div>
                      )}
                    </CellDrop>
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
