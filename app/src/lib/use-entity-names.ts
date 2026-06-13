import { useMemo } from "react";
import type { ProblemEntities } from "./entities";

/** id -> display-name maps the timeline grid resolves labels through. */
export function useEntityNames(entities: ProblemEntities | null) {
  const subjectNames = useMemo(
    () => new Map((entities?.subjects ?? []).map((subject) => [subject.id, subject.name])),
    [entities],
  );
  const roomNames = useMemo(
    () => new Map((entities?.rooms ?? []).map((room) => [room.id, room.name])),
    [entities],
  );
  return { subjectNames, roomNames };
}
