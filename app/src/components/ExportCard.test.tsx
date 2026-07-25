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

const mocks = vi.hoisted(() => ({ saveTextFile: vi.fn() }));
vi.mock("../lib/export-file", () => ({ saveTextFile: mocks.saveTextFile, toCsv: () => "" }));

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

// A day whose slot_overrides run past slots_per_day, with no labels: the
// synthetic cadence must come from the whole timetable, not from whichever
// sessions the chosen scope happens to contain.
const LONG_DAY: ProblemEntities = {
  ...ENTITIES,
  teachers: [
    { id: "t1", name: "Ada", unavailable: "" },
    { id: "t2", name: "Grace", unavailable: "" },
  ],
  slotsPerDay: 6,
  slotLabels: {},
};

const SHARED: ScheduleEntry = {
  subject_id: "math",
  day: "Monday",
  slot: 16,
  teacher_ids: ["t1", "t2"],
  group_ids: ["g1"],
  room_id: null,
};

const LATE: ScheduleEntry = { ...SHARED, subject_id: "lab", slot: 20, teacher_ids: ["t2"] };

describe("ExportCard calendar row", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.saveTextFile.mockReset();
    mocks.saveTextFile.mockResolvedValue(true);
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root.render(
        <ExportCard
          schedule={[SHARED, LATE]}
          entities={LONG_DAY}
          subjectNames={new Map()}
          roomNames={new Map()}
        />,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const clickButton = async (matches: (text: string) => boolean) => {
    const button = [...document.querySelectorAll("button")].find((candidate) =>
      matches(candidate.textContent ?? ""),
    );
    if (!button) throw new Error("button not found");
    await act(async () => {
      button.click();
    });
  };

  const exportFor = async (teacher: string): Promise<string> => {
    await clickButton((text) => text.includes("iCal / calendar sync"));
    await clickButton((text) => text.trim().startsWith(teacher));
    const calls = mocks.saveTextFile.mock.calls;
    if (calls.length === 0) throw new Error("no calendar saved");
    return calls[calls.length - 1][1] as string;
  };

  const startOfSlot16 = (ics: string): string => {
    const event = ics.split("BEGIN:VEVENT").find((block) => block.includes("math-mon-16"));
    return /DTSTART:\d{8}T(\d{6})/.exec(event ?? "")?.[1] ?? "";
  };

  it("times a shared session identically no matter whose calendar is exported", async () => {
    const ada = await exportFor("Ada");
    const grace = await exportFor("Grace");
    expect(startOfSlot16(ada)).not.toBe("");
    expect(startOfSlot16(ada)).toBe(startOfSlot16(grace));
  });

  // Deliberate: a lesson keeps one UID across every scope that attends it, so
  // importing a teacher's and a class's calendar together shows the single
  // meeting once instead of duplicating it per attendee.
  it("gives a shared session one UID across the teacher and the class calendars", async () => {
    const ada = await exportFor("Ada");
    const classA = await exportFor("Class A");
    const uid = (ics: string) => /UID:(\S+)/.exec(ics)?.[1] ?? "";
    expect(uid(ada)).not.toBe("");
    expect(uid(ada)).toBe(uid(classA));
  });
});
