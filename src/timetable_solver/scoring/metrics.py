"""Per-metric quality scorers — each returns (score 0-100, detail messages)."""

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import ScheduleEntry
from timetable_solver.scoring.grid import entity_day_slots, gap_hours, total_hours

MetricResult = tuple[float, list[str]]


def student_gaps(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Fewer free slots inside group days is better (100 = zero gaps)."""
    return _gap_metric(entity_day_slots(schedule, "group_ids"), "Group")


def teacher_gaps(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Fewer free slots inside teacher days is better (100 = zero gaps)."""
    return _gap_metric(entity_day_slots(schedule, "teacher_ids"), "Teacher")


def subject_spread(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Subjects spread across the week score higher than same-day repeats."""
    sizes = {s.id: s.consecutive_hours or 1 for s in problem.subjects}
    by_subject_day: dict[tuple[str, str], int] = {}
    for entry in schedule:
        key = (entry.subject_id, entry.day)
        by_subject_day[key] = by_subject_day.get(key, 0) + 1
    details: list[str] = []
    extra = 0
    sessions = 0
    for (subject_id, day), hours in by_subject_day.items():
        day_sessions = max(1, hours // sizes.get(subject_id, 1))
        sessions += day_sessions
        if day_sessions > 1:
            extra += day_sessions - 1
            details.append(f"Subject {subject_id!r} has {day_sessions} sessions on {day}")
    score = 100.0 if sessions == 0 else max(0.0, 100.0 * (1 - extra / sessions))
    return score, details


def teacher_preferences(
    problem: TimetableProblem, schedule: list[ScheduleEntry]
) -> MetricResult:
    """Respecting per-slot avoid/preferred markings scores higher."""
    grid = entity_day_slots(schedule, "teacher_ids")
    details: list[str] = []
    avoid_hits = 0
    preferred_hits = 0
    marked_hours = 0
    for teacher in problem.teachers:
        prefs = teacher.preferences
        if prefs is None or not prefs.slot_preferences:
            continue
        marked_hours += sum(
            len(slots) for (tid, _), slots in grid.items() if tid == teacher.id
        )
        for day, slot_prefs in prefs.slot_preferences.items():
            scheduled = set(grid.get((teacher.id, day), []))
            for slot, preference in slot_prefs.items():
                if slot not in scheduled:
                    continue
                if preference == "avoid":
                    avoid_hits += 1
                    details.append(f"Teacher {teacher.id!r} teaches avoided {day} slot {slot}")
                else:
                    preferred_hits += 1
    if marked_hours == 0:
        return 100.0, details
    net = max(0, avoid_hits - preferred_hits)
    return max(0.0, 100.0 * (1 - net / marked_hours)), details


def compactness(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Match each teacher's schedule_style: compact days vs spread-out days."""
    grid = entity_day_slots(schedule, "teacher_ids")
    components: list[float] = []
    details: list[str] = []
    for teacher in problem.teachers:
        style = teacher.preferences.schedule_style if teacher.preferences else None
        if style is None:
            continue
        for (tid, day), slots in grid.items():
            if tid != teacher.id:
                continue
            possible = problem.time_structure.get_slots_for_day(day) - len(slots)
            if possible <= 0:
                components.append(100.0)
                continue
            gap_ratio = min(1.0, gap_hours(slots) / possible)
            component = 100.0 * (gap_ratio if style == "spread" else 1 - gap_ratio)
            components.append(component)
            if component < 100.0:
                details.append(
                    f"Teacher {tid!r} {day}: {gap_hours(slots)} gap(s) vs {style!r} style"
                )
    score = sum(components) / len(components) if components else 100.0
    return score, details


def workload_balance(
    problem: TimetableProblem, schedule: list[ScheduleEntry]
) -> MetricResult:
    """Evenly distributed daily hours per teacher score higher."""
    grid = entity_day_slots(schedule, "teacher_ids")
    day_count = len(problem.time_structure.days)
    components: list[float] = []
    details: list[str] = []
    for teacher in problem.teachers:
        daily = {day: len(slots) for (tid, day), slots in grid.items() if tid == teacher.id}
        week = sum(daily.values())
        if week == 0 or day_count < 2:
            continue
        deviation = sum(
            abs(day_count * daily.get(day, 0) - week) for day in problem.time_structure.days
        )
        worst = 2 * (day_count - 1) * week
        ratio = deviation / worst if worst else 0.0
        components.append(100.0 * (1 - ratio))
        if ratio > 0.5:
            details.append(f"Teacher {teacher.id!r}: uneven daily load {daily}")
    score = sum(components) / len(components) if components else 100.0
    return score, details


def _gap_metric(grid: dict[tuple[str, str], list[int]], label: str) -> MetricResult:
    """Linear gap scoring shared by student and teacher gap metrics."""
    details: list[str] = []
    gaps = 0
    for (entity_id, day), slots in grid.items():
        day_gaps = gap_hours(slots)
        if day_gaps:
            gaps += day_gaps
            details.append(f"{label} {entity_id!r} {day}: {day_gaps} gap hour(s)")
    hours = total_hours(grid)
    score = 100.0 if hours == 0 else max(0.0, 100.0 * (1 - gaps / hours))
    return score, details
