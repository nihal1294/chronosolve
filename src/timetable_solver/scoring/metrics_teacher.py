"""Per-metric scorers for the 4 base TeacherPreferences soft weights (M7.5).

Scorer mirrors of solver/soft_teacher.py. Each metric is a mean of per-teacher
sub-scores over teachers WITH the preference set (mean_score), so one ignored
preference visibly moves its metric; no configured teachers scores a vacuous
100. Weights are applied by quality.py, never here.
"""

import math

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import ScheduleEntry
from timetable_solver.scoring.grid import entity_day_slots
from timetable_solver.scoring.metrics import MetricResult
from timetable_solver.scoring.metrics_advanced import mean_score


def _busy_days(grid: dict[tuple[str, str], list[int]], teacher_id: str) -> dict[str, list[int]]:
    """This teacher's occupied slots keyed by day."""
    return {day: slots for (tid, day), slots in grid.items() if tid == teacher_id and slots}


def _adjacent_pairs(slots: list[int]) -> int:
    """Back-to-back busy pairs within one day."""
    present = set(slots)
    return sum(1 for slot in present if slot + 1 in present)


def _window_excess(slots: list[int], cap: int) -> int:
    """Fully-busy windows of cap+1 slots (a run of length L adds L - cap)."""
    present = set(slots)
    if len(present) <= cap:
        return 0
    low, high = min(present), max(present)
    return sum(
        1
        for start in range(low, high - cap + 1)
        if all(slot in present for slot in range(start, start + cap + 1))
    )


def _best_pairs(busy_count: int, cap: int | None) -> int:
    """Max rewardable pairs for busy_count hours split into runs of at most cap."""
    if busy_count <= 0:
        return 0
    return busy_count - (math.ceil(busy_count / cap) if cap else 1)


def consecutive_hours(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Mirror of _consecutive_terms + _run_cap_terms: honor each teacher's
    back-to-back direction ("avoid" penalizes pairs; "prefer" rewards them up
    to max_consecutive-length runs)."""
    grid = entity_day_slots(schedule, "teacher_ids")
    components: list[float] = []
    details: list[str] = []
    for teacher in problem.teachers:
        prefs = teacher.preferences
        if prefs is None or not prefs.consecutive_hours:
            continue
        busy = _busy_days(grid, teacher.id)
        pairs = sum(_adjacent_pairs(slots) for slots in busy.values())
        if prefs.consecutive_hours == "avoid":
            worst = sum(max(len(slots) - 1, 0) for slots in busy.values())
            components.append(100.0 if worst == 0 else 100.0 * (1 - pairs / worst))
            if pairs:
                details.append(f"Teacher {teacher.id!r}: {pairs} back-to-back hour pair(s)")
            continue
        cap = prefs.max_consecutive
        excess = sum(_window_excess(slots, cap) for slots in busy.values()) if cap else 0
        best = sum(_best_pairs(len(slots), cap) for slots in busy.values())
        score = 100.0 if best <= 0 else 100.0 * min(max((pairs - excess) / best, 0.0), 1.0)
        components.append(score)
        if score < 100.0:
            issue = (
                f"run(s) exceed {cap} consecutive hours"
                if excess
                else f"only {pairs} of {best} possible back-to-back pair(s)"
            )
            details.append(f"Teacher {teacher.id!r}: {issue}")
    return mean_score(components), details


def leave_early(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Mirror of _leave_early_terms: hours after each teacher's per-day cutoff."""
    grid = entity_day_slots(schedule, "teacher_ids")
    components: list[float] = []
    details: list[str] = []
    for teacher in problem.teachers:
        cutoffs = teacher.preferences.leave_early if teacher.preferences else {}
        if not cutoffs:
            continue
        busy = _busy_days(grid, teacher.id)
        late = 0
        capacity = 0
        for day, cutoff in cutoffs.items():
            capacity += max(0, problem.time_structure.get_slots_for_day(day) - cutoff)
            day_late = sum(1 for slot in busy.get(day, []) if slot > cutoff)
            if day_late:
                late += day_late
                details.append(f"Teacher {teacher.id!r}: {day_late}h after slot {cutoff} on {day}")
        components.append(100.0 if capacity <= 0 else 100.0 * (1 - late / capacity))
    return mean_score(components), details


def max_daily_hours(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Mirror of _max_hours_terms: daily hours beyond each teacher's soft cap."""
    grid = entity_day_slots(schedule, "teacher_ids")
    components: list[float] = []
    details: list[str] = []
    for teacher in problem.teachers:
        cap = teacher.preferences.max_hours_per_day if teacher.preferences else None
        if not cap:
            continue
        busy = _busy_days(grid, teacher.id)
        excess = 0
        capacity = 0
        for day in problem.time_structure.days:
            capacity += max(0, problem.time_structure.get_slots_for_day(day) - cap)
            over = len(busy.get(day, [])) - cap
            if over > 0:
                excess += over
                details.append(f"Teacher {teacher.id!r}: {cap + over}h on {day} (cap {cap})")
        components.append(100.0 if capacity == 0 else 100.0 * (1 - excess / capacity))
    return mean_score(components), details


def free_days(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Mirror of _free_days_terms: shortfall below each teacher's min_free_days."""
    grid = entity_day_slots(schedule, "teacher_ids")
    components: list[float] = []
    details: list[str] = []
    for teacher in problem.teachers:
        wanted = teacher.preferences.min_free_days if teacher.preferences else None
        if not wanted:
            continue
        free = len(problem.time_structure.days) - len(_busy_days(grid, teacher.id))
        shortfall = max(0, wanted - free)
        components.append(100.0 * (1 - shortfall / wanted))
        if shortfall:
            details.append(f"Teacher {teacher.id!r}: {free} of {wanted} desired free days")
    return mean_score(components), details
