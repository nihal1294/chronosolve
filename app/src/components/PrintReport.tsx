import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { printPage } from "../lib/print-page";
import { pivotByAxis } from "../lib/timetable-filters";
import type { ProblemEntities } from "../lib/entities";
import type { ScheduleEntry } from "../lib/solver-client";

interface PrintReportProps {
  schedule: ScheduleEntry[];
  entities: ProblemEntities;
  subjectNames: Map<string, string>;
  roomNames: Map<string, string>;
  /** Increment to open the OS print dialog again; the mount itself prints once. */
  printSignal: number;
  /** Called with a message when opening the print dialog fails. */
  onProblem: (message: string) => void;
}

/** Master timetable report: one compact grid per student group, styled for
    paper. Invisible on screen - the portal exists only as print content, and
    every printSignal change triggers printPage() so the OS dialog opens
    directly (macOS saves to PDF from there). */
export function PrintReport({
  schedule,
  entities,
  subjectNames,
  roomNames,
  printSignal,
  onProblem,
}: PrintReportProps) {
  // Guarded per signal value: StrictMode runs the mount effect twice in dev,
  // which would stack two OS print dialogs on the first click.
  const lastPrinted = useRef(0);
  useEffect(() => {
    if (lastPrinted.current === printSignal) return;
    lastPrinted.current = printSignal;
    printPage().catch((problem: unknown) =>
      onProblem(problem instanceof Error ? problem.message : String(problem)),
    );
  }, [printSignal, onProblem]);

  const groups = pivotByAxis(schedule, "class");
  const days = entities.days;
  const slots = Array.from({ length: entities.slotsPerDay }, (_, i) => i + 1);
  const groupName = (id: string) => entities.groups.find((g) => g.id === id)?.name ?? id;

  const cell = (sessions: ScheduleEntry[], day: string, slot: number) => {
    const hits = sessions.filter((s) => s.day === day && s.slot === slot);
    return hits.map((s) => {
      const room = s.room_id === null ? "" : ` (${roomNames.get(s.room_id) ?? s.room_id})`;
      return `${subjectNames.get(s.subject_id) ?? s.subject_id}${room}`;
    });
  };

  // The print rules ship inside the portal (not styles.css): Tailwind v4's
  // entry-file processing drops top-level @media blocks it cannot attribute,
  // and an inline style element cannot be stripped. On screen the report is
  // display:none; the print pass flips it on and hides #root instead, so only
  // this portal (a sibling of #root on <body>) reaches paper.
  const printCss = `
    .print-report { display: none; }
    @media print {
      #root { display: none; }
      .print-report { display: block; }
      .print-page-break { break-after: page; }
    }`;

  return createPortal(
    <div className="print-report bg-white p-8 text-neutral-900">
      <style>{printCss}</style>
      {[...groups.entries()].map(([groupId, sessions], index) => (
        <section key={groupId} className={index < groups.size - 1 ? "print-page-break mb-8" : "mb-8"}>
          <h3 className="mb-2 text-base font-bold">{groupName(groupId)}</h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-neutral-400 px-2 py-1 text-left">Slot</th>
                {days.map((day) => (
                  <th key={day} className="border border-neutral-400 px-2 py-1 text-left">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot}>
                  <td className="border border-neutral-300 px-2 py-1 font-mono">
                    {entities.slotLabels[slot] ?? slot}
                  </td>
                  {days.map((day) => (
                    <td key={day} className="border border-neutral-300 px-2 py-1 align-top">
                      {cell(sessions, day, slot).map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>,
    document.body,
  );
}
