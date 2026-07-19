import { describe, expect, it } from "vitest";
import { buildConflictInputs } from "./conflict-model";
import { eligibleRooms } from "./room-eligibility";

/** A lab-preferring, gpu-requiring subject against four contrasting rooms. */
const doc = (patch: Record<string, unknown> = {}) => ({
  time_structure: { days: ["Mon"], slots_per_day: 4 },
  teachers: [{ id: "t1", name: "A" }],
  student_groups: [
    { id: "g1", name: "G1", size: 30 },
    { id: "g2", name: "G2", size: 25 },
  ],
  subjects: [
    {
      id: "cs",
      name: "CS",
      hours_per_week: 1,
      teacher_ids: ["t1"],
      group_ids: ["g1", "g2"],
      preferred_room_type: "lab",
      required_tags: ["gpu"],
    },
  ],
  rooms: [
    { id: "lecture", name: "Lecture", capacity: 100, type: "lecture", tags: ["gpu"] },
    { id: "bare", name: "Bare lab", capacity: 60, type: "lab", tags: [] },
    { id: "small", name: "Small lab", capacity: 40, type: "lab", tags: ["gpu"] },
    { id: "multi", name: "Multi", capacity: 60, type: "any", tags: ["gpu"] },
  ],
  ...patch,
});

const options = (patch: Record<string, unknown> = {}) => eligibleRooms(buildConflictInputs(doc(patch)), "cs");

describe("eligibleRooms", () => {
  it("judges every doc room in order, reporting the FIRST failing rule", () => {
    expect(options()).toEqual([
      { roomId: "lecture", eligible: false, reason: "wrong type" },
      { roomId: "bare", eligible: false, reason: "missing tags: gpu" },
      { roomId: "small", eligible: true, reason: null },
      { roomId: "multi", eligible: true, reason: null },
    ]);
  });

  it("gates capacity behind the opt-in flag (need = summed group sizes)", () => {
    const strict = options({ constraints: { hard: { room_capacity: true } } });
    expect(strict.find((o) => o.roomId === "small")).toEqual({
      roomId: "small",
      eligible: false,
      reason: "seats 40, needs 55",
    });
    expect(strict.find((o) => o.roomId === "multi")).toEqual({
      roomId: "multi",
      eligible: true,
      reason: null,
    });
  });

  it("blocks reserved rooms for subjects off the allow-list (rule 24)", () => {
    const reserved = options({
      constraints: {
        hard: { room_capacity: true },
        advanced: { room_reservations: [{ room_id: "multi", subject_ids: ["bio"] }] },
      },
    });
    expect(reserved.find((o) => o.roomId === "multi")).toEqual({
      roomId: "multi",
      eligible: false,
      reason: "reserved for other subjects",
    });
    // A listed subject keeps the room; capacity still applies AFTER reservations.
    const allowed = options({
      constraints: {
        hard: { room_capacity: true },
        advanced: { room_reservations: [{ room_id: "small", subject_ids: ["cs"] }] },
      },
    });
    expect(allowed.find((o) => o.roomId === "small")).toEqual({
      roomId: "small",
      eligible: false,
      reason: "seats 40, needs 55",
    });
    expect(allowed.find((o) => o.roomId === "multi")?.eligible).toBe(true);
  });

  it("lets a subject with no preferences use every room", () => {
    const inputs = buildConflictInputs(
      doc({
        subjects: [{ id: "math", name: "M", hours_per_week: 1, teacher_ids: ["t1"], group_ids: ["g1"] }],
      }),
    );
    expect(eligibleRooms(inputs, "math").every((o) => o.eligible)).toBe(true);
    // An unknown subject has nothing to judge against - everything stays usable.
    expect(eligibleRooms(inputs, "ghost").every((o) => o.eligible)).toBe(true);
  });
});
