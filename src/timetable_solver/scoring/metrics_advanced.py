"""Per-metric scorers for the M7.1 advanced soft rules (15, 26, 27, 28).

Scorer mirrors of solver/rules_soft.py. Each metric is a mean of per-instance
sub-scores (mean_score) so one broken rule visibly moves its metric - a
whole-schedule ratio would dilute a single violation to nothing.
"""

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import ScheduleEntry
from timetable_solver.models.time_structure import halfday_slots
from timetable_solver.scoring.grid import daily_balance_ratio, entity_day_slots
from timetable_solver.scoring.metrics import MetricResult


def mean_score(components: list[float]) -> float:
    """Mean per-instance sub-score, or a perfect 100 when nothing applies."""
    return sum(components) / len(components) if components else 100.0


def group_balance(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Rule 28: each group's hours spread evenly across days (group analog of
    workload_balance)."""
    grid = entity_day_slots(schedule, "group_ids")
    components: list[float] = []
    details: list[str] = []
    for group in problem.student_groups:
        daily = {day: len(slots) for (gid, day), slots in grid.items() if gid == group.id}
        ratio = daily_balance_ratio(daily, problem.time_structure.days)
        if ratio is None:
            continue
        components.append(100.0 * (1 - ratio))
        if ratio > 0.5:
            details.append(f"Group {group.id!r}: uneven daily load {daily}")
    return mean_score(components), details


def lab_adjacency(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Rule 27: a group's lab hours in adjacent slots score lower.

    A multi-hour lab block counts as adjacent on purpose - the CP-SAT builder
    pays the same penalty for it.
    """
    lab_ids = {s.id for s in problem.subjects if s.type == "lab"}
    by_group_day: dict[tuple[str, str], set[int]] = {}
    for entry in schedule:
        if entry.subject_id in lab_ids:
            for gid in entry.group_ids:
                by_group_day.setdefault((gid, entry.day), set()).add(entry.slot)
    components: list[float] = []
    details: list[str] = []
    for (gid, day), slot_set in by_group_day.items():
        slots = sorted(slot_set)
        if len(slots) < 2:
            continue
        adjacent = sum(1 for a, b in zip(slots, slots[1:], strict=False) if b - a == 1)
        components.append(100.0 * (1 - adjacent / (len(slots) - 1)))
        if adjacent:
            details.append(f"Group {gid!r} has back-to-back labs on {day} (slots {slots})")
    return mean_score(components), details


def free_halfday(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Rule 15: requested group half-days stay free of classes."""
    requests = problem.constraints.advanced.group_free_halfdays
    grid = entity_day_slots(schedule, "group_ids")
    day_names = set(problem.time_structure.days)
    components: list[float] = []
    details: list[str] = []
    for req in requests:
        if req.day not in day_names:
            continue
        window = set(halfday_slots(problem.time_structure.get_slots_for_day(req.day), req.half))
        if not window:  # a 1-slot day has no afternoon
            continue
        occupied = window & set(grid.get((req.group_id, req.day), []))
        components.append(100.0 * (1 - len(occupied) / len(window)))
        if occupied:
            details.append(
                f"Group {req.group_id!r} has {len(occupied)} class(es) in the requested "
                f"free {req.day} {req.half}"
            )
    return mean_score(components), details


def room_stability(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> MetricResult:
    """Rule 26: listed subjects keep one room across all their sessions."""
    listed = set(problem.constraints.advanced.same_room_subjects)
    rooms_used: dict[str, set[str]] = {}
    sessions: dict[str, int] = {}
    for entry in schedule:
        if entry.subject_id in listed:
            sessions[entry.subject_id] = sessions.get(entry.subject_id, 0) + 1
            if entry.room_id is not None:
                rooms_used.setdefault(entry.subject_id, set()).add(entry.room_id)
    components: list[float] = []
    details: list[str] = []
    for sid in sorted(listed):
        count = sessions.get(sid, 0)
        if count < 2:
            continue
        extra = max(0, len(rooms_used.get(sid, set())) - 1)
        components.append(100.0 * (1 - extra / (count - 1)))
        if extra:
            details.append(f"Subject {sid!r} uses {extra + 1} different rooms across the week")
    return mean_score(components), details
