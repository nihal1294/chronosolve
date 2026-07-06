"""Schedule grid utilities shared by scoring metrics and statistics."""

from timetable_solver.models.schedule import ScheduleEntry

# (entity_id, day) -> sorted slot numbers
EntityDaySlots = dict[tuple[str, str], list[int]]


def entity_day_slots(schedule: list[ScheduleEntry], attr: str) -> EntityDaySlots:
    """Group scheduled slots by (entity, day) for teacher_ids or group_ids.

    Args:
        schedule: Schedule entries to index.
        attr: Entry attribute holding entity ids ("teacher_ids" or "group_ids").

    Returns:
        Mapping of (entity_id, day) to sorted slot numbers.
    """
    grid: EntityDaySlots = {}
    for entry in schedule:
        for entity_id in getattr(entry, attr):
            grid.setdefault((entity_id, entry.day), []).append(entry.slot)
    for slots in grid.values():
        slots.sort()
    return grid


def subject_day_slots(schedule: list[ScheduleEntry]) -> EntityDaySlots:
    """Group scheduled slots by (subject_id, day), sorted.

    Subject analog of entity_day_slots, whose attrs are list-valued.
    """
    grid: EntityDaySlots = {}
    for entry in schedule:
        grid.setdefault((entry.subject_id, entry.day), []).append(entry.slot)
    for slots in grid.values():
        slots.sort()
    return grid


def first_position(
    grid: EntityDaySlots, subject_id: str, days: list[str], max_slots: int
) -> int | None:
    """Earliest day_index * max_slots + slot the subject occupies, None if absent.

    Mirrors solver.rule_helpers.first_index's global position formula so the
    scorer and the CP-SAT ordering constraint agree on "starts before".
    """
    positions = [
        day_idx * max_slots + slots[0]
        for day_idx, day in enumerate(days)
        if (slots := grid.get((subject_id, day)))
    ]
    return min(positions) if positions else None


def gap_hours(slots: list[int]) -> int:
    """Free slots strictly between the first and last occupied slot of a day."""
    if len(slots) < 2:
        return 0
    return (slots[-1] - slots[0] + 1) - len(slots)


def total_gaps(grid: EntityDaySlots) -> int:
    """Sum of gap hours across all (entity, day) cells."""
    return sum(gap_hours(slots) for slots in grid.values())


def total_hours(grid: EntityDaySlots) -> int:
    """Sum of scheduled hours across all (entity, day) cells."""
    return sum(len(slots) for slots in grid.values())


def daily_balance_ratio(daily: dict[str, int], days: list[str]) -> float | None:
    """Deviation of daily hours from a perfectly even split, 0.0 (even) to 1.0.

    Shared by the teacher and group workload-balance metrics (same formula the
    CP-SAT rule-28 builder integer-scales). None when there is nothing to
    balance (no hours, or a single-day week).
    """
    week = sum(daily.values())
    day_count = len(days)
    if week == 0 or day_count < 2:
        return None
    deviation = sum(abs(day_count * daily.get(day, 0) - week) for day in days)
    worst = 2 * (day_count - 1) * week
    return deviation / worst if worst else 0.0
