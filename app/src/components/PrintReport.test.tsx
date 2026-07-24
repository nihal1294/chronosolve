import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PrintReport } from "./PrintReport";
import type { ProblemEntities } from "../lib/entities";
import type { ScheduleEntry } from "../lib/solver-client";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ENTITIES: ProblemEntities = {
  subjects: [],
  teachers: [],
  groups: [
    { id: "g1", name: "Class A", size: null, department: "", semester: "" },
    { id: "g2", name: "Class B", size: null, department: "", semester: "" },
  ],
  rooms: [],
  preAssignments: [],
  days: ["Monday"],
  slotsPerDay: 2,
  slotLabels: {},
};

const SCHEDULE: ScheduleEntry[] = [
  {
    subject_id: "math",
    day: "Monday",
    slot: 1,
    teacher_ids: ["t1"],
    group_ids: ["g1"],
    room_id: null,
  },
];

describe("PrintReport", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.print = vi.fn<() => void>();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        <PrintReport
          schedule={SCHEDULE}
          entities={ENTITIES}
          subjectNames={new Map()}
          roomNames={new Map()}
          printSignal={1}
          onProblem={() => {}}
        />,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("renders a grid for every class, including ones with no scheduled sessions", () => {
    const report = document.querySelector(".print-report");
    expect(report).not.toBeNull();
    expect(report?.querySelectorAll("section")).toHaveLength(2);
    expect(report?.textContent).toContain("Class A");
    expect(report?.textContent).toContain("Class B");
  });
});
