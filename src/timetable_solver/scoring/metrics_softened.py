"""Per-metric scorers for softened rule instances (M7.3 soften-to-preference).

Inverse gate of scoring/violations_advanced: the hard checks skip is_softened
instances, these metrics count ONLY them - priced by the matching soft_<kind>
weight in quality._METRICS, the same split the CP-SAT builders implement.
Per-instance mean scoring throughout (see metrics_advanced.mean_score).
"""

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.rules import is_softened
from timetable_solver.models.schedule import ScheduleEntry
from timetable_solver.scoring.grid import entity_day_slots, first_position, subject_day_slots
from timetable_solver.scoring.metrics import MetricResult
from timetable_solver.scoring.metrics_advanced import mean_score


def softened_breaks(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Softened global breaks: fraction of each window's slots kept class-free."""
    advanced = problem.constraints.advanced
    occupied_by_day: dict[str, set[int]] = {}
    for entry in schedule:
        occupied_by_day.setdefault(entry.day, set()).add(entry.slot)
    components: list[float] = []
    details: list[str] = []
    for i, brk in enumerate(advanced.global_breaks):
        if not is_softened(advanced, "break", str(i)):
            continue
        hit = set(brk.slots) & occupied_by_day.get(brk.day, set())
        components.append(100.0 * (1 - len(hit) / len(brk.slots)))
        if hit:
            details.append(f"Softened {brk.day} break has classes in slot(s) {sorted(hit)}")
    return mean_score(components), details


def softened_allowed_slots(
    problem: TimetableProblem, schedule: list[ScheduleEntry]
) -> MetricResult:
    """Softened allowed-slot subjects: fraction of their hours inside the window."""
    advanced = problem.constraints.advanced
    windows = {
        s.id: set(s.allowed_slots)
        for s in problem.subjects
        if s.allowed_slots is not None and is_softened(advanced, "allowed_slots", s.id)
    }
    hours: dict[str, int] = {}
    outside: dict[str, int] = {}
    for entry in schedule:
        window = windows.get(entry.subject_id)
        if window is None:
            continue
        hours[entry.subject_id] = hours.get(entry.subject_id, 0) + 1
        if entry.slot not in window:
            outside[entry.subject_id] = outside.get(entry.subject_id, 0) + 1
    components: list[float] = []
    details: list[str] = []
    for sid in sorted(windows):
        total = hours.get(sid, 0)
        if total == 0:
            continue
        out = outside.get(sid, 0)
        components.append(100.0 * (1 - out / total))
        if out:
            details.append(f"Subject {sid!r} has {out} hour(s) outside its preferred slots")
    return mean_score(components), details


def softened_teacher_caps(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Softened daily caps: overage hours relative to the teacher's week."""
    advanced = problem.constraints.advanced
    caps = {
        tid: cap
        for tid, cap in advanced.hard_teacher_daily_caps.items()
        if is_softened(advanced, "teacher_cap", tid)
    }
    if not caps:
        return 100.0, []
    grid = entity_day_slots(schedule, "teacher_ids")
    components: list[float] = []
    details: list[str] = []
    for tid, cap in caps.items():
        daily = [len(slots) for (t, _), slots in grid.items() if t == tid]
        week = sum(daily)
        if week == 0:
            continue
        over = sum(max(0, h - cap) for h in daily)
        components.append(100.0 * (1 - over / week))
        if over:
            details.append(
                f"Teacher {tid!r} exceeds the preferred {cap}h/day cap by {over} hour(s)"
            )
    return mean_score(components), details


def softened_same_day(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Softened same-day exclusions: shared days vs the possible overlap."""
    advanced = problem.constraints.advanced
    grid = subject_day_slots(schedule)
    components: list[float] = []
    details: list[str] = []
    for i, pair in enumerate(advanced.same_day_exclusions):
        if not is_softened(advanced, "same_day", str(i)):
            continue
        first_days = {day for (sid, day) in grid if sid == pair.first}
        second_days = {day for (sid, day) in grid if sid == pair.second}
        possible = min(len(first_days), len(second_days))
        if possible == 0:
            continue
        both = len(first_days & second_days)
        components.append(100.0 * (1 - both / possible))
        if both:
            details.append(
                f"{pair.first!r} and {pair.second!r} share {both} day(s) despite the "
                f"softened exclusion"
            )
    return mean_score(components), details


def softened_orderings(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Softened orderings: honored scores 100, violated 0, averaged per instance.

    A pair with either subject unscheduled is skipped, like the CP-SAT builder.
    """
    advanced = problem.constraints.advanced
    grid = subject_day_slots(schedule)
    days = problem.time_structure.days
    max_slots = max(problem.time_structure.get_slots_for_day(d) for d in days)
    components: list[float] = []
    details: list[str] = []
    for i, pair in enumerate(advanced.orderings):
        if not is_softened(advanced, "ordering", str(i)):
            continue
        first = first_position(grid, pair.first, days, max_slots)
        second = first_position(grid, pair.second, days, max_slots)
        if first is None or second is None:
            continue
        honored = first < second
        components.append(100.0 if honored else 0.0)
        if not honored:
            details.append(
                f"{pair.first!r} does not start before {pair.second!r} (softened ordering)"
            )
    return mean_score(components), details
