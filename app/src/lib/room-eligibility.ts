import type { ConflictInputs, RoomFacts, SubjectFacts } from "./conflict-model";

/** One picker row: a doc room plus whether the subject may use it. */
export interface RoomOption {
  roomId: string;
  eligible: boolean;
  /** First failing rule in compatible_rooms order; null when eligible. */
  reason: string | null;
}

/** Every doc room judged for `subjectId`, in doc order - the picker's model.
    Mirrors the backend's compatible_rooms MINUS reservations (those stay
    backend authority via /score): room type, required tags, then the opt-in
    capacity check. An unknown subject has nothing to judge against, so every
    room stays usable. */
export function eligibleRooms(inputs: ConflictInputs, subjectId: string): RoomOption[] {
  const subject = inputs.subjects.get(subjectId);
  const need = subject ? subject.groupIds.reduce((sum, g) => sum + (inputs.groupSizes.get(g) ?? 0), 0) : 0;
  return [...inputs.rooms.entries()].map(([roomId, room]) => {
    const reason = subject ? firstFailure(subject, room, need, inputs.flags.roomCapacity) : null;
    return { roomId, eligible: reason === null, reason };
  });
}

/** The first rule the room breaks, in the same order compatible_rooms
    filters: type, tags, capacity ("any" matches in both directions). */
function firstFailure(
  subject: SubjectFacts,
  room: RoomFacts,
  need: number,
  capacityOn: boolean,
): string | null {
  const pref = subject.preferredRoomType;
  if (pref && pref !== "any" && room.type !== pref && room.type !== "any") return "wrong type";
  const missing = subject.requiredTags.filter((tag) => !room.tags.includes(tag));
  if (missing.length > 0) return `missing tags: ${missing.join(", ")}`;
  if (capacityOn && room.capacity !== null && need > room.capacity) {
    return `seats ${room.capacity}, needs ${need}`;
  }
  return null;
}
