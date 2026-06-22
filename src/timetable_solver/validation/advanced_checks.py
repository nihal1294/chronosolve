"""Pre-solve feasibility checks for M7 advanced rules and room requirements.

Kept separate from validator.py to keep each module focused. Invoked by
validate_problem after the core checks. All findings are cheap, structural
demand-vs-supply checks (no solving).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from timetable_solver.models.room import room_type_matches
from timetable_solver.validation.validator import Severity, ValidationIssue

if TYPE_CHECKING:
    from timetable_solver.models.problem import TimetableProblem
    from timetable_solver.models.subject import Subject


def check_advanced_rules(problem: TimetableProblem, issues: list[ValidationIssue]) -> None:
    """Run the room and advanced-rule pre-checks (capacity warning, tags, breaks)."""
    if problem.rooms:
        _check_room_capacity_warnings(problem, issues)
        _check_required_tags(problem, issues)
        if problem.constraints.hard.room_capacity:
            _check_capacity_feasibility(problem, issues)
    _check_global_break_capacity(problem, issues)


def _check_room_capacity_warnings(problem: TimetableProblem, issues: list[ValidationIssue]) -> None:
    """Warn when a subject's group size exceeds all rooms of its required type."""
    group_sizes = {g.id: g.size for g in problem.student_groups}
    rooms_by_type: dict[str, int] = {}
    for room in problem.rooms:
        rooms_by_type[room.type] = max(rooms_by_type.get(room.type, 0), room.capacity)
    max_any_capacity = max(r.capacity for r in problem.rooms)  # "any" type uses any room
    for subj in problem.subjects:
        total_students = sum(group_sizes.get(gid, 0) for gid in subj.group_ids)
        room_type = subj.preferred_room_type or "any"
        max_cap = rooms_by_type.get(room_type, max_any_capacity)
        if total_students > max_cap:
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    message=(
                        f"Subject {subj.id!r} has {total_students} students "
                        f"but largest {room_type!r} room holds {max_cap}"
                    ),
                )
            )


def _eligible_rooms(problem: TimetableProblem, subject: Subject) -> list:
    """Rooms matching a subject's type preference and required_tags (capacity aside)."""
    return [
        r
        for r in problem.rooms
        if room_type_matches(r.type, subject.preferred_room_type)
        and subject.required_tags <= r.tags
    ]


def _check_required_tags(problem: TimetableProblem, issues: list[ValidationIssue]) -> None:
    """Error when a subject's required_tags are met by no room (rule 19)."""
    for subj in problem.subjects:
        if subj.required_tags and not _eligible_rooms(problem, subj):
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    message=(
                        f"Subject {subj.id!r} requires room tags "
                        f"{sorted(subj.required_tags)} but no room provides them"
                    ),
                )
            )


def _check_capacity_feasibility(problem: TimetableProblem, issues: list[ValidationIssue]) -> None:
    """Error when room_capacity is on but no eligible room fits a subject (rule 25)."""
    sizes = {g.id: g.size for g in problem.student_groups}
    for subj in problem.subjects:
        demand = sum(sizes.get(gid, 0) for gid in subj.group_ids)
        eligible = _eligible_rooms(problem, subj)
        if eligible and not any(r.capacity >= demand for r in eligible):
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    message=(
                        f"Subject {subj.id!r} needs {demand} seats but no eligible "
                        f"room is large enough (room_capacity is on)"
                    ),
                )
            )


def _check_global_break_capacity(problem: TimetableProblem, issues: list[ValidationIssue]) -> None:
    """Error when global breaks leave a group fewer slots than its required hours (rule 2)."""
    breaks = problem.constraints.advanced.global_breaks
    if not breaks:
        return
    days = set(problem.time_structure.days)
    blocked = 0
    for brk in breaks:
        if brk.day not in days:
            continue
        max_slot = problem.time_structure.get_slots_for_day(brk.day)
        blocked += len({s for s in brk.slots if 1 <= s <= max_slot})
    available = problem.time_structure.total_slots() - blocked
    group_hours: dict[str, int] = {}
    for subj in problem.subjects:
        for gid in subj.group_ids:
            group_hours[gid] = group_hours.get(gid, 0) + subj.hours_per_week
    for group in problem.student_groups:
        required = group_hours.get(group.id, 0)
        if required > available:
            issues.append(
                ValidationIssue(
                    severity=Severity.ERROR,
                    message=(
                        f"Group {group.id!r} needs {required} hours but global "
                        f"breaks leave only {available} slots"
                    ),
                )
            )
