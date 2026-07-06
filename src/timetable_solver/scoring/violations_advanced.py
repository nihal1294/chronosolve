"""Hard violation checks for the M7 advanced rules - the scorer mirror of rules_hard.

Each check mirrors its CP-SAT builder and skips instances the user softened
(advanced.softened): those are priced by scoring/metrics_softened instead, the
same skip/price split the solver implements. Folded into find_hard_violations
so the annealer and /score see advanced rules through the existing entry point.
"""

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.rules import is_softened
from timetable_solver.models.schedule import ScheduleEntry
from timetable_solver.scoring.grid import (
    EntityDaySlots,
    entity_day_slots,
    first_position,
    subject_day_slots,
)


def find_advanced_violations(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> list[str]:
    """Check every un-softened advanced rule and describe each violation found.

    Args:
        problem: The problem whose advanced rules apply.
        schedule: Schedule entries to check (any source, not just the solver).

    Returns:
        Human-readable violation messages (empty list means no advanced rule
        is violated; softened instances never appear here).
    """
    grid = subject_day_slots(schedule)
    violations: list[str] = []
    violations += _break_violations(problem, schedule)
    violations += _allowed_slot_violations(problem, schedule)
    violations += _teacher_cap_violations(problem, schedule)
    violations += _same_day_violations(problem, grid)
    violations += _ordering_violations(problem, grid)
    violations += _room_eligibility_violations(problem, schedule)
    return violations


def _break_violations(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> list[str]:
    """Entries scheduled inside an un-softened global break window (rule 2)."""
    advanced = problem.constraints.advanced
    blocked: set[tuple[str, int]] = set()
    for i, brk in enumerate(advanced.global_breaks):
        if is_softened(advanced, "break", str(i)):
            continue
        blocked.update((brk.day, slot) for slot in brk.slots)
    return [
        f"Subject {e.subject_id!r} scheduled inside the {e.day} slot {e.slot} global break"
        for e in schedule
        if (e.day, e.slot) in blocked
    ]


def _allowed_slot_violations(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> list[str]:
    """Entries outside a subject's un-softened allowed_slots window (rule 3)."""
    advanced = problem.constraints.advanced
    allowed = {
        s.id: set(s.allowed_slots)
        for s in problem.subjects
        if s.allowed_slots is not None and not is_softened(advanced, "allowed_slots", s.id)
    }
    return [
        f"Subject {e.subject_id!r} on {e.day} slot {e.slot} is outside its "
        f"allowed slots {sorted(allowed[e.subject_id])}"
        for e in schedule
        if e.subject_id in allowed and e.slot not in allowed[e.subject_id]
    ]


def _teacher_cap_violations(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> list[str]:
    """Days where a teacher exceeds an un-softened daily cap (rule 5-H)."""
    advanced = problem.constraints.advanced
    caps = {
        tid: cap
        for tid, cap in advanced.hard_teacher_daily_caps.items()
        if not is_softened(advanced, "teacher_cap", tid)
    }
    if not caps:
        return []
    found: list[str] = []
    for (tid, day), slots in entity_day_slots(schedule, "teacher_ids").items():
        cap = caps.get(tid)
        if cap is not None and len(slots) > cap:
            found.append(f"Teacher {tid!r} teaches {len(slots)}h on {day} (cap {cap}h/day)")
    return found


def _same_day_violations(problem: TimetableProblem, grid: EntityDaySlots) -> list[str]:
    """Days where both subjects of an un-softened exclusion pair appear (rule 22)."""
    advanced = problem.constraints.advanced
    found: list[str] = []
    for i, pair in enumerate(advanced.same_day_exclusions):
        if is_softened(advanced, "same_day", str(i)):
            continue
        for day in problem.time_structure.days:
            if grid.get((pair.first, day)) and grid.get((pair.second, day)):
                found.append(
                    f"Subjects {pair.first!r} and {pair.second!r} are both scheduled on {day}"
                )
    return found


def _ordering_violations(problem: TimetableProblem, grid: EntityDaySlots) -> list[str]:
    """Un-softened orderings where `second` starts at or before `first` (rule 23).

    A pair with either subject unscheduled is skipped, like the CP-SAT builder.
    """
    advanced = problem.constraints.advanced
    days = problem.time_structure.days
    max_slots = max(problem.time_structure.get_slots_for_day(d) for d in days)
    found: list[str] = []
    for i, pair in enumerate(advanced.orderings):
        if is_softened(advanced, "ordering", str(i)):
            continue
        first = first_position(grid, pair.first, days, max_slots)
        second = first_position(grid, pair.second, days, max_slots)
        if first is None or second is None:
            continue
        if first >= second:
            found.append(f"Subject {pair.first!r} must start before {pair.second!r} but does not")
    return found


def _room_eligibility_violations(
    problem: TimetableProblem, schedule: list[ScheduleEntry]
) -> list[str]:
    """Rooms violating required tags (19), reservations (24), or opt-in capacity (25).

    Mirrors solver.variables.compatible_rooms; room *type* stays covered by
    violations._room_type_violations. Each (subject, room) pairing is reported
    once, however many hours use it.
    """
    if not problem.rooms:
        return []
    rooms = {r.id: r for r in problem.rooms}
    subjects = {s.id: s for s in problem.subjects}
    reserved = {
        res.room_id: set(res.subject_ids) for res in problem.constraints.advanced.room_reservations
    }
    sizes = {g.id: g.size for g in problem.student_groups}
    check_capacity = problem.constraints.hard.room_capacity
    found: list[str] = []
    seen: set[tuple[str, str]] = set()
    for entry in schedule:
        room = rooms.get(entry.room_id) if entry.room_id else None
        subject = subjects.get(entry.subject_id)
        if room is None or subject is None or (subject.id, room.id) in seen:
            continue
        seen.add((subject.id, room.id))
        if not subject.required_tags <= room.tags:
            missing = sorted(subject.required_tags - room.tags)
            found.append(f"Room {room.id!r} lacks tags {missing} required by {subject.id!r}")
        if room.id in reserved and subject.id not in reserved[room.id]:
            found.append(
                f"Room {room.id!r} is reserved and {subject.id!r} is not on its allow-list"
            )
        if check_capacity:
            need = sum(sizes.get(gid, 0) for gid in subject.group_ids)
            if room.capacity < need:
                found.append(
                    f"Room {room.id!r} seats {room.capacity} but {subject.id!r} needs {need}"
                )
    return found
