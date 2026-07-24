import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ExportCard } from "./ExportCard";
import type { ProblemEntities } from "../lib/entities";
import type { ScheduleEntry } from "../lib/solver-client";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const ENTITIES: ProblemEntities = {
  subjects: [],
  teachers: [{ id: "t1", name: "Ada", unavailable: "" }],
  groups: [{ id: "g1", name: "Class A", size: null, department: "", semester: "" }],
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

describe("ExportCard PDF row", () => {
  let host: HTMLDivElement;
  let root: Root;
  let printSpy: Mock<() => void>;

  beforeEach(() => {
    printSpy = vi.fn<() => void>();
    window.print = printSpy;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    // StrictMode mirrors main.tsx: mount effects run twice in dev, so this
    // harness catches a print dialog firing per effect run instead of per click.
    act(() => {
      root.render(
        <StrictMode>
          <ExportCard
            schedule={SCHEDULE}
            entities={ENTITIES}
            subjectNames={new Map([["math", "Mathematics"]])}
            roomNames={new Map()}
          />
        </StrictMode>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const pdfRow = (): HTMLButtonElement => {
    const button = [...document.querySelectorAll("button")].find((candidate) =>
      candidate.textContent?.includes("Master PDF report"),
    );
    if (!button) throw new Error("PDF export row not rendered");
    return button;
  };

  it("opens the OS print dialog directly on click (no preview step)", () => {
    act(() => pdfRow().click());
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("prints again on every subsequent click", () => {
    act(() => pdfRow().click());
    act(() => pdfRow().click());
    expect(printSpy).toHaveBeenCalledTimes(2);
  });
});
