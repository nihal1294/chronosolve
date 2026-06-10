"""Schedule statistics — workload, utilization, and gap summaries."""

from dataclasses import dataclass, field

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import ScheduleEntry
from timetable_solver.scoring.grid import entity_day_slots, gap_hours


@dataclass
class ScheduleStatistics:
    """Aggregate numbers describing a schedule.

    Attributes:
        teacher_hours: Total weekly hours per teacher.
        group_hours: Total weekly hours per student group.
        room_utilization: Fraction of all slots each room is occupied (0.0-1.0).
        busiest_day: Day with the most scheduled entries ("" for empty schedules).
        avg_student_gap: Mean gap hours per (group, day) with classes.
        avg_teacher_gap: Mean gap hours per (teacher, day) with classes.
    """

    teacher_hours: dict[str, int] = field(default_factory=dict)
    group_hours: dict[str, int] = field(default_factory=dict)
    room_utilization: dict[str, float] = field(default_factory=dict)
    busiest_day: str = ""
    avg_student_gap: float = 0.0
    avg_teacher_gap: float = 0.0


def compute_statistics(
    problem: TimetableProblem, schedule: list[ScheduleEntry]
) -> ScheduleStatistics:
    """Compute summary statistics for a schedule.

    Args:
        problem: The problem definition (for rooms and the time grid).
        schedule: Schedule entries to summarize.

    Returns:
        ScheduleStatistics with totals, utilization, and average gaps.
    """
    teacher_grid = entity_day_slots(schedule, "teacher_ids")
    group_grid = entity_day_slots(schedule, "group_ids")
    return ScheduleStatistics(
        teacher_hours=_entity_totals(teacher_grid),
        group_hours=_entity_totals(group_grid),
        room_utilization=_room_utilization(problem, schedule),
        busiest_day=_busiest_day(problem, schedule),
        avg_student_gap=_average_gap(group_grid),
        avg_teacher_gap=_average_gap(teacher_grid),
    )


def _entity_totals(grid: dict[tuple[str, str], list[int]]) -> dict[str, int]:
    """Total scheduled hours per entity across all days."""
    totals: dict[str, int] = {}
    for (entity_id, _), slots in grid.items():
        totals[entity_id] = totals.get(entity_id, 0) + len(slots)
    return totals


def _room_utilization(
    problem: TimetableProblem, schedule: list[ScheduleEntry]
) -> dict[str, float]:
    """Occupied fraction of the full weekly slot grid for each room."""
    if not problem.rooms:
        return {}
    total_slots = problem.time_structure.total_slots()
    occupied: dict[str, int] = {room.id: 0 for room in problem.rooms}
    for entry in schedule:
        if entry.room_id in occupied:
            occupied[entry.room_id] += 1
    return {rid: round(count / total_slots, 4) for rid, count in occupied.items()}


def _busiest_day(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> str:
    """Day with the most entries, ties broken by day order; "" when empty."""
    if not schedule:
        return ""
    counts: dict[str, int] = {}
    for entry in schedule:
        counts[entry.day] = counts.get(entry.day, 0) + 1
    return max(problem.time_structure.days, key=lambda d: counts.get(d, 0))


def _average_gap(grid: dict[tuple[str, str], list[int]]) -> float:
    """Mean gap hours across all (entity, day) cells that have classes."""
    if not grid:
        return 0.0
    return round(sum(gap_hours(slots) for slots in grid.values()) / len(grid), 4)
