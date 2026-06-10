"""Pre-solve feasibility validation — catches unsolvable or suspicious inputs.

Pydantic handles structural validation (types, references). This module checks
semantic feasibility: can the solver actually produce a valid schedule?
"""

from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from timetable_solver.models.problem import TimetableProblem


class Severity(StrEnum):
    """Validation issue severity."""

    ERROR = "error"
    WARNING = "warning"


class ValidationIssue(BaseModel):
    """A single validation finding."""

    severity: Severity
    message: str


def validate_problem(problem: TimetableProblem) -> list[ValidationIssue]:
    """Run all pre-solve checks on a timetable problem.

    Args:
        problem: A structurally valid TimetableProblem.

    Returns:
        List of issues found (empty means all clear).
    """
    issues: list[ValidationIssue] = []
    _check_group_hours_feasibility(problem, issues)
    _check_teacher_availability_feasibility(problem, issues)
    _check_pre_assignment_clashes(problem, issues)
    _check_room_capacity_warnings(problem, issues)
    return issues


def _check_group_hours_feasibility(
    problem: TimetableProblem,
    issues: list[ValidationIssue],
) -> None:
    """Verify each group has enough slots for all its subjects."""
    group_hours: dict[str, int] = {}
    for subj in problem.subjects:
        for gid in subj.group_ids:
            group_hours[gid] = group_hours.get(gid, 0) + subj.hours_per_week

    day_count = len(problem.time_structure.days)
    for group in problem.student_groups:
        available = _available_slots_for_entity(problem, group.unavailable)
        if group.max_hours_per_day is not None:
            available = min(available, group.max_hours_per_day * day_count)
        required = group_hours.get(group.id, 0)
        if required > available:
            issues.append(ValidationIssue(
                severity=Severity.ERROR,
                message=(
                    f"Group {group.id!r} needs {required} hours/week "
                    f"but only has {available} available slots"
                ),
            ))
        elif required > available * 0.9:
            issues.append(ValidationIssue(
                severity=Severity.WARNING,
                message=(
                    f"Group {group.id!r} uses {required}/{available} slots "
                    f"({required * 100 // available}%) — solver may struggle"
                ),
            ))


def _check_teacher_availability_feasibility(
    problem: TimetableProblem,
    issues: list[ValidationIssue],
) -> None:
    """Verify each teacher has enough available slots for their subjects."""
    teacher_hours: dict[str, int] = {}
    for subj in problem.subjects:
        for tid in subj.teacher_ids:
            teacher_hours[tid] = teacher_hours.get(tid, 0) + subj.hours_per_week

    for teacher in problem.teachers:
        available = _available_slots_for_entity(problem, teacher.unavailable)
        required = teacher_hours.get(teacher.id, 0)
        if required > available:
            issues.append(ValidationIssue(
                severity=Severity.ERROR,
                message=(
                    f"Teacher {teacher.id!r} needs {required} hours/week "
                    f"but only has {available} available slots"
                ),
            ))
        elif available > 0 and required > available * 0.9:
            issues.append(ValidationIssue(
                severity=Severity.WARNING,
                message=(
                    f"Teacher {teacher.id!r} uses {required}/{available} slots "
                    f"({required * 100 // available}%) — very tight schedule"
                ),
            ))


def _check_pre_assignment_clashes(
    problem: TimetableProblem,
    issues: list[ValidationIssue],
) -> None:
    """Detect pre-assignments that conflict on teacher or group at the same time."""
    subject_map = {s.id: s for s in problem.subjects}
    slot_teachers: dict[tuple[str, int], list[str]] = {}
    slot_groups: dict[tuple[str, int], list[str]] = {}

    for pa in problem.pre_assignments:
        subj = subject_map.get(pa.subject_id)
        if subj is None:
            continue  # Pydantic already catches missing references
        key = (pa.day, pa.slot)
        for tid in subj.teacher_ids:
            slot_teachers.setdefault(key, []).append(tid)
        for gid in subj.group_ids:
            slot_groups.setdefault(key, []).append(gid)

    _report_duplicates(slot_teachers, "Teacher", issues)
    _report_duplicates(slot_groups, "Group", issues)


def _report_duplicates(
    slot_map: dict[tuple[str, int], list[str]],
    label: str,
    issues: list[ValidationIssue],
) -> None:
    """Flag any slot where the same entity appears more than once."""
    for (day, slot), ids in slot_map.items():
        seen: set[str] = set()
        for entity_id in ids:
            if entity_id in seen:
                issues.append(ValidationIssue(
                    severity=Severity.ERROR,
                    message=(
                        f"{label} {entity_id!r} has clashing "
                        f"pre-assignments on {day} slot {slot}"
                    ),
                ))
            seen.add(entity_id)


def _check_room_capacity_warnings(
    problem: TimetableProblem,
    issues: list[ValidationIssue],
) -> None:
    """Warn when a subject's group size exceeds all rooms of its required type."""
    if not problem.rooms:
        return

    group_sizes = {g.id: g.size for g in problem.student_groups}
    rooms_by_type: dict[str, int] = {}
    for room in problem.rooms:
        key = room.type
        rooms_by_type[key] = max(rooms_by_type.get(key, 0), room.capacity)
    # "any" type can use any room
    max_any_capacity = max(r.capacity for r in problem.rooms)

    for subj in problem.subjects:
        total_students = sum(group_sizes.get(gid, 0) for gid in subj.group_ids)
        room_type = subj.preferred_room_type or "any"
        max_cap = rooms_by_type.get(room_type, max_any_capacity)
        if total_students > max_cap:
            issues.append(ValidationIssue(
                severity=Severity.WARNING,
                message=(
                    f"Subject {subj.id!r} has {total_students} students "
                    f"but largest {room_type!r} room holds {max_cap}"
                ),
            ))


def _available_slots_for_entity(
    problem: TimetableProblem,
    unavailable: dict[str, list[int]],
) -> int:
    """Count total available slots minus unavailable ones."""
    total = problem.time_structure.total_slots()
    blocked = sum(len(slots) for slots in unavailable.values())
    return total - blocked
