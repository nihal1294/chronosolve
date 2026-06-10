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
