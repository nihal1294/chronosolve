import { describe, expect, it } from "vitest";
import { buildConflictInputs } from "./conflict-model";

const DOC = {
  time_structure: { days: ["Mon", "Tue"], slots_per_day: 4 },
  teachers: [{ id: "t1", name: "A", unavailable: { Mon: [3, 4] } }],
  student_groups: [{ id: "g1", name: "G", size: 30, unavailable: { Tue: [1] } }],
  subjects: [
    {
      id: "cs",
      name: "CS",
      hours_per_week: 1,
      teacher_ids: ["t1"],
      group_ids: ["g1"],
      preferred_room_type: "lab",
      required_tags: ["gpu"],
    },
  ],
  rooms: [{ id: "r1", name: "R1", capacity: 20, type: "lab", tags: ["gpu"] }],
  constraints: { hard: { room_capacity: true, respect_availability: false } },
};

describe("buildConflictInputs", () => {
  it("extracts typed lookups from a raw problem doc", () => {
    const inputs = buildConflictInputs(DOC);
    expect(inputs.subjects.get("cs")).toEqual({
      teacherIds: ["t1"],
      groupIds: ["g1"],
      preferredRoomType: "lab",
      requiredTags: ["gpu"],
    });
    expect(inputs.rooms.get("r1")).toEqual({
      capacity: 20,
      type: "lab",
      tags: ["gpu"],
      reservedFor: null,
    });
    expect(inputs.groupSizes.get("g1")).toBe(30);
    expect(inputs.teacherUnavailable.get("t1")?.get("Mon")).toEqual(new Set([3, 4]));
    expect(inputs.groupUnavailable.get("g1")?.get("Tue")).toEqual(new Set([1]));
    expect(inputs.flags).toEqual({
      teacherNoClash: true,
      groupNoClash: true,
      roomNoClash: true,
      respectAvailability: false,
      roomCapacity: true,
    });
  });

  it("intersects room_reservations per room (rule 24 mirror)", () => {
    const inputs = buildConflictInputs({
      ...DOC,
      rooms: [...DOC.rooms, { id: "r2", name: "R2", capacity: 20, type: "lab", tags: [] }],
      constraints: {
        advanced: {
          room_reservations: [
            { room_id: "r1", subject_ids: ["cs", "bio"] },
            { room_id: "r1", subject_ids: ["cs"] },
          ],
        },
      },
    });
    // A subject must appear in EVERY entry for the room, so the sets intersect.
    expect(inputs.rooms.get("r1")?.reservedFor).toEqual(new Set(["cs"]));
    expect(inputs.rooms.get("r2")?.reservedFor).toBeNull();
  });

  it("yields empty structures and backend-default flags on a malformed doc", () => {
    const inputs = buildConflictInputs({ subjects: "nope" });
    expect(inputs.subjects.size).toBe(0);
    expect(inputs.rooms.size).toBe(0);
    // Defaults mirror models/constraints.py: clash+availability on, capacity OFF.
    expect(inputs.flags.roomCapacity).toBe(false);
    expect(inputs.flags.respectAvailability).toBe(true);
  });
});
