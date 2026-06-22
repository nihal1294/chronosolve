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
    """Run the room and advanced-rule pre-checks (capacity warning, tags, breaks, refs)."""
    if problem.rooms:
        _check_room_capacity_warnings(problem, issues)
        _check_required_tags(problem, issues)
        if problem.constraints.hard.room_capacity:
            _check_capacity_feasibility(problem, issues)
    _check_global_break_capacity(problem, issues)
    _check_advanced_references(problem, issues)


def _check_advanced_references(problem: TimetableProblem, issues: list[ValidationIssue]) -> None:
    """Error on advanced-rule references to entities that do not exist (typos).

    Without this, a misspelled day/room/subject/teacher/group silently no-ops the
    rule (the generator finds no matching variables), yielding a schedule that
    ignores the user's intent instead of rejecting the bad input.
    """
    adv = problem.constraints.advanced
    days = set(problem.time_structure.days)
    subjects = {s.id for s in problem.subjects}
    teachers = {t.id for t in problem.teachers}
    groups = {g.id for g in problem.student_groups}
    rooms = {r.id for r in problem.rooms}

    def err(kind: str, value: str) -> None:
        issues.append(
            ValidationIssue(
                severity=Severity.ERROR,
                message=f"Advanced rule references unknown {kind} {value!r}",
            )
        )

    for brk in adv.global_breaks:
        if brk.day not in days:
            err("day", brk.day)
    for res in adv.room_reservations:
        if res.room_id not in rooms:
            err("room", res.room_id)
        for sid in res.subject_ids:
            if sid not in subjects:
                err("subject", sid)
    for tid in adv.hard_teacher_daily_caps:
        if tid not in teachers:
            err("teacher", tid)
    for pair in [*adv.same_day_exclusions, *adv.orderings]:
        for sid in (pair.first, pair.second):
            if sid not in subjects:
                err("subject", sid)
    for sid in adv.same_room_subjects:
        if sid not in subjects:
            err("subject", sid)
    for halfday in adv.group_free_halfdays:
        if halfday.group_id not in groups:
            err("group", halfday.group_id)
        if halfday.day not in days:
            err("day", halfday.day)


def _check_room_capacity_warnings(problem: TimetableProblem, issues: list[ValidationIssue]) -> None:
    """Warn when a subject's group size exceeds every room it may actually use.

    Uses _eligible_rooms (type + required_tags) so the baseline matches the error
    checks; subjects with no eligible room at all are skipped here because
    _check_required_tags already emits an ERROR for them.
    """
    group_sizes = {g.id: g.size for g in problem.student_groups}
    for subj in problem.subjects:
        eligible = _eligible_rooms(problem, subj)
        if not eligible:
            continue
        total_students = sum(group_sizes.get(gid, 0) for gid in subj.group_ids)
        max_cap = max(r.capacity for r in eligible)
        if total_students > max_cap:
            issues.append(
                ValidationIssue(
                    severity=Severity.WARNING,
                    message=(
                        f"Subject {subj.id!r} has {total_students} students "
                        f"but largest eligible room holds {max_cap}"
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
    # Track (day, slot) pairs across every break entry: the solver blocks each
    # pair once, so a slot repeated in two break objects must not be subtracted
    # twice (that would falsely reject a feasible problem).
    blocked_pairs: set[tuple[str, int]] = set()
    for brk in breaks:
        if brk.day not in days:
            continue
        max_slot = problem.time_structure.get_slots_for_day(brk.day)
        blocked_pairs.update((brk.day, s) for s in brk.slots if 1 <= s <= max_slot)
    available = problem.time_structure.total_slots() - len(blocked_pairs)
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
