"""Hard constraint violation detection for arbitrary schedules."""

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import ScheduleEntry
from timetable_solver.scoring.grid import entity_day_slots


def find_hard_violations(
    problem: TimetableProblem, schedule: list[ScheduleEntry]
) -> list[str]:
    """Check every hard constraint and describe each violation found.

    Args:
        problem: The problem the schedule claims to solve.
        schedule: Schedule entries to check (any source, not just the solver).

    Returns:
        Human-readable violation messages (empty list means schedule is valid).
    """
    violations: list[str] = []
    hard = problem.constraints.hard
    if hard.teacher_no_clash:
        violations += _clashes(schedule, "teacher_ids", "Teacher")
    if hard.group_no_clash:
        violations += _clashes(schedule, "group_ids", "Group")
    if hard.room_no_clash:
        violations += _room_clashes(schedule)
    if hard.respect_availability:
        violations += _availability_violations(problem, schedule)
    if hard.required_hours:
        violations += _hour_violations(problem, schedule)
    violations += _block_violations(problem, schedule)
    violations += _max_per_day_violations(problem, schedule)
    return violations


def _clashes(schedule: list[ScheduleEntry], attr: str, label: str) -> list[str]:
    """Entities scheduled into the same (day, slot) more than once."""
    found: list[str] = []
    for (entity_id, day), slots in entity_day_slots(schedule, attr).items():
        seen: set[int] = set()
        for slot in slots:
            if slot in seen:
                found.append(f"{label} {entity_id!r} double-booked on {day} slot {slot}")
            seen.add(slot)
    return found


def _room_clashes(schedule: list[ScheduleEntry]) -> list[str]:
    """Rooms hosting more than one entry in the same (day, slot)."""
    found: list[str] = []
    seen: set[tuple[str, str, int]] = set()
    for entry in schedule:
        if entry.room_id is None:
            continue
        key = (entry.room_id, entry.day, entry.slot)
        if key in seen:
            found.append(f"Room {entry.room_id!r} double-booked on {entry.day} slot {entry.slot}")
        seen.add(key)
    return found


def _availability_violations(
    problem: TimetableProblem, schedule: list[ScheduleEntry]
) -> list[str]:
    """Entries placed where a teacher or group is unavailable."""
    blocked: dict[tuple[str, str, int], str] = {}
    for entity in [*problem.teachers, *problem.student_groups]:
        for day, slots in entity.unavailable.items():
            for slot in slots:
                blocked[(entity.id, day, slot)] = entity.id
    found: list[str] = []
    for entry in schedule:
        for entity_id in [*entry.teacher_ids, *entry.group_ids]:
            if (entity_id, entry.day, entry.slot) in blocked:
                found.append(
                    f"{entity_id!r} scheduled during unavailable {entry.day} slot {entry.slot}"
                )
    return found


def _hour_violations(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> list[str]:
    """Subjects scheduled for a different number of hours than required."""
    counts: dict[str, int] = {}
    for entry in schedule:
        counts[entry.subject_id] = counts.get(entry.subject_id, 0) + 1
    found: list[str] = []
    for subject in problem.subjects:
        actual = counts.get(subject.id, 0)
        if actual != subject.hours_per_week:
            found.append(
                f"Subject {subject.id!r} scheduled {actual}h, requires {subject.hours_per_week}h"
            )
    return found


def _block_violations(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> list[str]:
    """Consecutive-hour subjects whose daily slots do not form whole blocks."""
    found: list[str] = []
    by_subject_day: dict[tuple[str, str], list[int]] = {}
    for entry in schedule:
        by_subject_day.setdefault((entry.subject_id, entry.day), []).append(entry.slot)
    sizes = {s.id: s.consecutive_hours or 1 for s in problem.subjects}
    for (subject_id, day), slots in by_subject_day.items():
        size = sizes.get(subject_id, 1)
        if size <= 1:
            continue
        slots.sort()
        if len(slots) % size != 0 or not _is_block_partition(slots, size):
            found.append(
                f"Subject {subject_id!r} on {day}: slots {slots} are not "
                f"contiguous blocks of {size}"
            )
    return found


def _max_per_day_violations(
    problem: TimetableProblem, schedule: list[ScheduleEntry]
) -> list[str]:
    """Subjects exceeding their daily session cap (blocks count as one session)."""
    found: list[str] = []
    subjects = {s.id: s for s in problem.subjects}
    hours: dict[tuple[str, str], int] = {}
    for entry in schedule:
        key = (entry.subject_id, entry.day)
        hours[key] = hours.get(key, 0) + 1
    for (subject_id, day), count in hours.items():
        subject = subjects.get(subject_id)
        if subject is None:
            continue
        size = subject.consecutive_hours or 1
        sessions = count // size if size > 1 else count
        if sessions > subject.max_per_day:
            found.append(
                f"Subject {subject_id!r} has {sessions} sessions on {day} "
                f"(max_per_day={subject.max_per_day})"
            )
    return found


def _is_block_partition(slots: list[int], size: int) -> bool:
    """True when sorted slots split into runs of exactly `size` consecutive numbers."""
    for i in range(0, len(slots), size):
        chunk = slots[i : i + size]
        if chunk != list(range(chunk[0], chunk[0] + size)):
            return False
    return True
