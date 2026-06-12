"""Top-level problem model - the complete input for the solver."""

from pydantic import BaseModel, Field, model_validator

from timetable_solver.models.constraints import ConstraintsConfig
from timetable_solver.models.pre_assignment import PreAssignment
from timetable_solver.models.room import Room, room_type_matches
from timetable_solver.models.student_group import StudentGroup
from timetable_solver.models.subject import Subject
from timetable_solver.models.teacher import Teacher
from timetable_solver.models.time_structure import TimeStructure


class TimetableProblem(BaseModel):
    """Complete timetable scheduling problem definition.

    Args:
        time_structure: Days and slots configuration.
        teachers: All teachers to be scheduled.
        student_groups: All student groups.
        subjects: All subjects/events to place.
        rooms: Physical rooms (optional - omit to skip room constraints).
        pre_assignments: Fixed slot assignments (optional).
        constraints: Hard and soft constraint configuration.
    """

    time_structure: TimeStructure
    teachers: list[Teacher] = Field(min_length=1)
    student_groups: list[StudentGroup] = Field(min_length=1)
    subjects: list[Subject] = Field(min_length=1)
    rooms: list[Room] = Field(default_factory=list)
    pre_assignments: list[PreAssignment] = Field(default_factory=list)
    constraints: ConstraintsConfig = Field(default_factory=ConstraintsConfig)

    @model_validator(mode="after")
    def _validate_references(self) -> "TimetableProblem":
        """Verify all cross-entity ID references are valid."""
        errors = _collect_reference_errors(self)
        if errors:
            raise ValueError("Invalid references:\n  " + "\n  ".join(errors))
        return self


def _collect_reference_errors(problem: "TimetableProblem") -> list[str]:
    """Check all ID references across entities and return error messages."""
    teacher_ids = {t.id for t in problem.teachers}
    group_ids = {g.id for g in problem.student_groups}
    subject_map = {s.id: s for s in problem.subjects}
    room_ids = {r.id for r in problem.rooms}
    days = set(problem.time_structure.days)
    errors: list[str] = []

    _check_duplicate_ids(problem, errors)

    for subj in problem.subjects:
        for tid in subj.teacher_ids:
            if tid not in teacher_ids:
                errors.append(f"Subject {subj.id!r}: unknown teacher_id {tid!r}")
        for gid in subj.group_ids:
            if gid not in group_ids:
                errors.append(f"Subject {subj.id!r}: unknown group_id {gid!r}")

    for pa in problem.pre_assignments:
        if pa.subject_id not in subject_map:
            errors.append(f"PreAssignment: unknown subject_id {pa.subject_id!r}")
        if pa.day not in days:
            errors.append(f"PreAssignment: unknown day {pa.day!r}")
            continue
        max_slot = problem.time_structure.get_slots_for_day(pa.day)
        if pa.slot > max_slot:
            errors.append(f"PreAssignment: slot {pa.slot} exceeds max {max_slot} for {pa.day!r}")
            continue
        subj = subject_map.get(pa.subject_id)
        block = (subj.consecutive_hours or 1) if subj else 1
        if pa.slot + block - 1 > max_slot:
            errors.append(
                f"PreAssignment: {pa.subject_id!r} needs {block} consecutive slots "
                f"from slot {pa.slot} but {pa.day!r} ends at slot {max_slot}"
            )

    _check_availability_days(problem.teachers, days, "Teacher", errors)
    _check_availability_days(problem.student_groups, days, "StudentGroup", errors)
    _check_preference_days(problem.teachers, days, errors)

    if problem.rooms:
        _check_room_references(problem, room_ids, errors)

    return errors


def _check_duplicate_ids(problem: "TimetableProblem", errors: list[str]) -> None:
    """Reject duplicate IDs - solver variables and lookups key on them."""
    entity_lists = [
        ("Teacher", problem.teachers),
        ("StudentGroup", problem.student_groups),
        ("Subject", problem.subjects),
        ("Room", problem.rooms),
    ]
    for label, entities in entity_lists:
        seen: set[str] = set()
        for entity in entities:
            if entity.id in seen:
                errors.append(f"Duplicate {label} id {entity.id!r}")
            seen.add(entity.id)


def _check_availability_days(
    entities: list[Teacher] | list[StudentGroup],
    valid_days: set[str],
    label: str,
    errors: list[str],
) -> None:
    """Verify unavailable slots reference valid days."""
    for entity in entities:
        for day in entity.unavailable:
            if day not in valid_days:
                errors.append(f"{label} {entity.id!r}: unavailable references unknown day {day!r}")


def _check_preference_days(
    teachers: list[Teacher],
    valid_days: set[str],
    errors: list[str],
) -> None:
    """Verify slot_preferences and leave_early reference declared days."""
    for teacher in teachers:
        prefs = teacher.preferences
        if prefs is None:
            continue
        for day in [*prefs.slot_preferences, *prefs.leave_early]:
            if day not in valid_days:
                errors.append(f"Teacher {teacher.id!r}: preferences reference unknown day {day!r}")


def _check_room_references(
    problem: "TimetableProblem",
    room_ids: set[str],
    errors: list[str],
) -> None:
    """Verify subject preferred_room_type can be satisfied by available rooms.

    Uses the same compatibility predicate as solver variable creation, so
    multipurpose ("any") rooms satisfy every preference here too.
    """
    for subj in problem.subjects:
        if subj.preferred_room_type is None:
            continue
        if not any(
            room_type_matches(room.type, subj.preferred_room_type) for room in problem.rooms
        ):
            errors.append(
                f"Subject {subj.id!r}: preferred_room_type {subj.preferred_room_type!r} "
                f"has no matching rooms"
            )
