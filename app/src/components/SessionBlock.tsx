import { useDrag } from "react-dnd";
import type { ScheduleEntry } from "../lib/solver-client";
import { blockHue, type BlockHue } from "../lib/block-hue";
import { SESSION_DND_TYPE, type DragItem } from "../lib/drag-rules";

/* Block hues mirror the design system's Timeline spec: teal = standard
   placement, indigo + lock = pre-assigned, rose + pulsing strip = hard
   conflict (the pulse stays on the strip so the labels remain readable). */
const HUE: Record<BlockHue, { box: string; strip: string; code: string; meta: string; ring: string }> = {
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
  rose: {
    box: "bg-rose-500/10 border-rose-500/40 hover:bg-rose-500/20",
    strip: "bg-rose-500 animate-pulse",
    code: "text-rose-700 dark:text-rose-400",
    meta: "text-rose-600/80 dark:text-rose-500/80",
    ring: "ring-2 ring-rose-500",
  },
};

export interface SessionBlockProps {
  entry: ScheduleEntry;
  locked: boolean;
  conflicted: boolean;
  secondary: string;
  selected: boolean;
  /** Block geometry to drag with, or null when this block cannot move
      (pinned, or the view has no manual-edit context). */
  dragItem: DragItem | null;
  onSelect: (entry: ScheduleEntry) => void;
  onContextMenu: (event: React.MouseEvent, entry: ScheduleEntry) => void;
}

/** One session on the weekly grid; a drag source when dragItem is provided. */
export function SessionBlock({
  entry,
  locked,
  conflicted,
  secondary,
  selected,
  dragItem,
  onSelect,
  onContextMenu,
}: SessionBlockProps) {
  const [{ dragging }, drag] = useDrag(
    () => ({
      type: SESSION_DND_TYPE,
      item: () => dragItem as DragItem, // only invoked when canDrag passes
      canDrag: dragItem !== null,
      collect: (monitor) => ({ dragging: monitor.isDragging() }),
    }),
    [dragItem],
  );
  const hue = HUE[blockHue(conflicted, locked)];
  return (
    <button
      // React 19 treats a callback ref's return value as a cleanup fn, so the
      // react-dnd connector (which returns the node) must be wrapped.
      ref={(node) => void drag(node)}
      onClick={() => onSelect(entry)}
      onContextMenu={(event) => onContextMenu(event, entry)}
      title={locked ? "Pinned - unpin to move" : undefined}
      className={`relative w-full rounded-md border px-2 py-1 text-left transition-all ${hue.box} ${selected ? hue.ring : ""} ${dragging ? "opacity-40" : ""} ${dragItem ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${hue.strip}`} />
      <div className={`text-[10px] font-bold leading-tight ${hue.code}`}>{entry.subject_id}</div>
      {secondary && <div className={`truncate text-[9px] leading-tight ${hue.meta}`}>{secondary}</div>}
    </button>
  );
}
