"""Schedule verification helpers - independent re-checks of every hard constraint.

Used by solver tests so a buggy solver can't grade its own homework.
"""

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import ScheduleEntry


def assert_hard_constraints(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> None:
    """Assert every hard constraint holds in the given schedule."""
    assert_no_entity_clash(schedule, "teacher_ids")
    assert_no_entity_clash(schedule, "group_ids")
    assert_no_room_clash(schedule)
    assert_availability_respected(problem, schedule)
    assert_required_hours(problem, schedule)
    assert_blocks_contiguous(problem, schedule)
    assert_max_per_day(problem, schedule)
    assert_group_max_hours(problem, schedule)


def assert_no_entity_clash(schedule: list[ScheduleEntry], attr: str) -> None:
    """No teacher/group appears twice in the same (day, slot)."""
    seen: set[tuple[str, str, int]] = set()
    for entry in schedule:
        for entity_id in getattr(entry, attr):
            key = (entity_id, entry.day, entry.slot)
            assert key not in seen, f"{attr} clash: {key}"
            seen.add(key)


def assert_no_room_clash(schedule: list[ScheduleEntry]) -> None:
    """No room hosts two entries in the same (day, slot)."""
    seen: set[tuple[str, str, int]] = set()
    for entry in schedule:
        if entry.room_id is None:
            continue
        key = (entry.room_id, entry.day, entry.slot)
        assert key not in seen, f"room clash: {key}"
        seen.add(key)


def assert_availability_respected(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> None:
    """No entry sits in a slot where any of its teachers or groups is unavailable."""
    blocked: set[tuple[str, str, int]] = set()
    for entity in [*problem.teachers, *problem.student_groups]:
        for day, slots in entity.unavailable.items():
            for slot in slots:
                blocked.add((entity.id, day, slot))
    for entry in schedule:
        for entity_id in [*entry.teacher_ids, *entry.group_ids]:
            assert (entity_id, entry.day, entry.slot) not in blocked, (
                f"{entity_id} scheduled in unavailable slot {entry.day}/{entry.slot}"
            )


def assert_required_hours(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> None:
    """Each subject appears exactly hours_per_week times."""
    counts: dict[str, int] = {}
    for entry in schedule:
        counts[entry.subject_id] = counts.get(entry.subject_id, 0) + 1
    for subject in problem.subjects:
        actual = counts.get(subject.id, 0)
        assert actual == subject.hours_per_week, (
            f"{subject.id}: scheduled {actual}h, requires {subject.hours_per_week}h"
        )


def assert_blocks_contiguous(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> None:
    """Consecutive-hour subjects occur in contiguous same-day, same-room runs."""
    for subject in problem.subjects:
        size = subject.consecutive_hours or 1
        if size <= 1:
            continue
        by_day: dict[str, list[ScheduleEntry]] = {}
        for entry in schedule:
            if entry.subject_id == subject.id:
                by_day.setdefault(entry.day, []).append(entry)
        for day, entries in by_day.items():
            entries.sort(key=lambda e: e.slot)
            slots = [e.slot for e in entries]
            assert len(slots) % size == 0, f"{subject.id} on {day}: partial block {slots}"
            for i in range(0, len(slots), size):
                chunk = entries[i : i + size]
                expected = list(range(chunk[0].slot, chunk[0].slot + size))
                assert [e.slot for e in chunk] == expected, (
                    f"{subject.id} on {day}: non-contiguous block {slots}"
                )
                rooms = {e.room_id for e in chunk}
                assert len(rooms) == 1, f"{subject.id} on {day}: block spans rooms {rooms}"


def assert_group_max_hours(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> None:
    """No group exceeds its max_hours_per_day cap on any day."""
    hours: dict[tuple[str, str], int] = {}
    for entry in schedule:
        for gid in entry.group_ids:
            hours[(gid, entry.day)] = hours.get((gid, entry.day), 0) + 1
    for group in problem.student_groups:
        if group.max_hours_per_day is None:
            continue
        for (gid, day), count in hours.items():
            if gid == group.id:
                assert count <= group.max_hours_per_day, (
                    f"{gid} has {count}h on {day} > cap {group.max_hours_per_day}"
                )


def assert_max_per_day(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> None:
    """Daily session counts never exceed max_per_day (blocks count as one session)."""
    for subject in problem.subjects:
        size = subject.consecutive_hours or 1
        per_day: dict[str, int] = {}
        for entry in schedule:
            if entry.subject_id == subject.id:
                per_day[entry.day] = per_day.get(entry.day, 0) + 1
        for day, hours in per_day.items():
            sessions = hours // size if size > 1 else hours
            assert sessions <= subject.max_per_day, (
                f"{subject.id} on {day}: {sessions} sessions > max {subject.max_per_day}"
            )
