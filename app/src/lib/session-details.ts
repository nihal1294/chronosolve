import type { ScheduleEntry } from "./solver-client";
import type { ProblemEntities } from "./entities";
import type { SessionDetails } from "../components/Inspector";

const nameMap = (rows: { id: string; name: string }[]): Map<string, string> =>
  new Map(rows.map((row) => [row.id, row.name]));

/** Shape a selected schedule entry for the Inspector's session card. */
export function buildSessionDetails(
  selected: ScheduleEntry,
  entities: ProblemEntities | null,
  locked: boolean,
): SessionDetails {
  const subjectNames = nameMap(entities?.subjects ?? []);
  const teacherNames = nameMap(entities?.teachers ?? []);
  const roomNames = nameMap(entities?.rooms ?? []);
  return {
    code: selected.subject_id,
    name: subjectNames.get(selected.subject_id) ?? selected.subject_id,
    day: selected.day,
    slotLabel: entities?.slotLabels[selected.slot] ?? `Slot ${selected.slot}`,
    locked,
    rows: [
      ["Instructor", selected.teacher_ids.map((id) => teacherNames.get(id) ?? id).join(", ") || "—"],
      ["Room", selected.room_id ? (roomNames.get(selected.room_id) ?? selected.room_id) : "—"],
      ["Groups", selected.group_ids.join(", ") || "—"],
      ["Placement", locked ? "Locked (pre-assigned)" : "Solver assigned"],
    ],
  };
}
