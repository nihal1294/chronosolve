import { Edit2, Lock, Unlock } from "lucide-react";
import type { MenuState } from "../components/ContextMenu";
import { scheduleKey } from "./grid";
import type { ScheduleEntry } from "./solver-client";

/** Verbs the session context menu needs from the workspace (grouped so the
    builder stays within the parameter limit). */
export interface SessionMenuDeps {
  lockedKeys: ReadonlySet<string>;
  roomName: (id: string | null) => string;
  pinBlock: (entry: ScheduleEntry) => void;
  unpinBlock: (entry: ScheduleEntry) => void;
  openEdit: (section: "subjects", id: string) => void;
}

/** Context-menu model for a timetable session block: pin/unpin (by lock
    state) + edit course. Extracted from TimetableRoute (M8c) so the route
    stays within its line budget; ContextMenu renders the result. */
export function sessionMenu(
  entry: ScheduleEntry,
  at: { x: number; y: number },
  deps: SessionMenuDeps,
): MenuState {
  const locked = deps.lockedKeys.has(scheduleKey(entry.subject_id, entry.day, entry.slot));
  return {
    x: at.x,
    y: at.y,
    width: "w-64",
    header: [entry.subject_id, entry.room_id ? deps.roomName(entry.room_id) : null]
      .filter(Boolean)
      .join(" • "),
    items: [
      locked
        ? { label: "Unpin from slot", icon: Unlock, shortcut: "P", onSelect: () => deps.unpinBlock(entry) }
        : { label: "Pin to slot", icon: Lock, shortcut: "P", onSelect: () => deps.pinBlock(entry) },
      {
        label: "Edit course",
        icon: Edit2,
        shortcut: "⌘E",
        onSelect: () => deps.openEdit("subjects", entry.subject_id),
      },
    ],
  };
}
