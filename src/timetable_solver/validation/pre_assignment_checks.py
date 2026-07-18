"""Pre-assignment feasibility checks - slot clashes and room-pin compatibility."""

from __future__ import annotations

from typing import TYPE_CHECKING

from timetable_solver.solver.variables import compatible_rooms
from timetable_solver.validation.validator import Severity, ValidationIssue

if TYPE_CHECKING:
    from timetable_solver.models.problem import TimetableProblem


def check_pre_assignments(problem: TimetableProblem, issues: list[ValidationIssue]) -> None:
    """Run every pre-assignment check (teacher/group clashes, room pins)."""
    _check_clashes(problem, issues)
    _check_rooms(problem, issues)


def _check_clashes(problem: TimetableProblem, issues: list[ValidationIssue]) -> None:
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
                issues.append(
                    ValidationIssue(
                        severity=Severity.ERROR,
                        message=(
                            f"{label} {entity_id!r} has clashing "
                            f"pre-assignments on {day} slot {slot}"
                        ),
                    )
                )
            seen.add(entity_id)


def _check_rooms(problem: TimetableProblem, issues: list[ValidationIssue]) -> None:
    """Error on room pins outside the builder's compatible_rooms set.

    Same predicate as room-variable creation (type, tags, reservations,
    opt-in capacity), so validation and solving agree on the allowed room
    set; the pin builder still fails clean on unvalidated paths (/solve
    skips this module).
    """
    subject_map = {s.id: s for s in problem.subjects}
    for pa in problem.pre_assignments:
        subj = subject_map.get(pa.subject_id)
        if pa.room_id is None or subj is None:
            continue
        if pa.room_id not in {room.id for room in compatible_rooms(subj, problem)}:
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    message=(
                        f"PreAssignment pins {pa.subject_id!r} to room "
                        f"{pa.room_id!r}, which is not compatible with the subject"
                    ),
                )
            )
