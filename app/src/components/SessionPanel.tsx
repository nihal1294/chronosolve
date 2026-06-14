import { Calendar, Edit2, Lock, Unlock, X } from "lucide-react";
import type { ScheduleEntry } from "../lib/solver-client";

interface SessionPanelProps {
  entry: ScheduleEntry;
  subjectName: string;
  roomName: string;
  teacherNames: string[];
  groupNames: string[];
  slotLabel: string;
  locked: boolean;
  onClose: () => void;
  onToggleLock: () => void;
  onEdit: () => void;
}

function Property({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-neutral-200 pb-1 text-xs dark:border-neutral-800">
      <span className="shrink-0 text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="truncate text-right">{value || "-"}</span>
    </div>
  );
}

/** Contextual detail pane for the selected timetable block (per-route, not a
    global rail). Carries the pin/unpin + edit affordances. */
export function SessionPanel(props: SessionPanelProps) {
  const { entry, subjectName, roomName, teacherNames, groupNames, slotLabel, locked } = props;
  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-950/50">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
        <span className="text-sm font-bold">Session</span>
        <button
          onClick={props.onClose}
          aria-label="Close"
          className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="text-lg font-bold leading-tight">{subjectName}</div>
          <div className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            {entry.subject_id}
          </div>
        </div>

        <div
          className={`rounded-lg border p-2.5 ${
            locked ? "border-indigo-500/30 bg-indigo-500/10" : "border-teal-500/30 bg-teal-500/10"
          }`}
        >
          <div
            className={`flex items-center gap-1 text-[10px] font-medium ${
              locked ? "text-indigo-600 dark:text-indigo-400" : "text-teal-600 dark:text-teal-400"
            }`}
          >
            {locked ? <Lock size={10} /> : <Calendar size={10} />}
            {locked ? "Pinned" : "Scheduled"}
          </div>
          <div className="mt-1 text-xs">
            {entry.day} • {slotLabel}
          </div>
        </div>

        <div className="space-y-2">
          <Property label="Room" value={roomName} />
          <Property label="Teachers" value={teacherNames.join(", ")} />
          <Property label="Groups" value={groupNames.join(", ")} />
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={props.onToggleLock}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-neutral-800 dark:hover:bg-white/5"
          >
            {locked ? <Unlock size={14} /> : <Lock size={14} />}
            {locked ? "Unpin from slot" : "Pin to this slot"}
          </button>
          <button
            onClick={props.onEdit}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-neutral-800 dark:hover:bg-white/5"
          >
            <Edit2 size={14} />
            Edit course
          </button>
        </div>
      </div>
    </aside>
  );
}
