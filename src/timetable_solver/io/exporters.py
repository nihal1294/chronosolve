"""Export solver results to JSON, CSV, and Rich-formatted tables."""

import csv
import io

from rich.console import Console
from rich.table import Table

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import ScheduleEntry, SolveResult


def to_json(result: SolveResult) -> str:
    """Export a solve result as a JSON string."""
    return result.model_dump_json(indent=2)


def to_csv(result: SolveResult) -> str:
    """Export schedule entries as CSV (one row per scheduled hour)."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["day", "slot", "subject", "teachers", "groups", "room"])
    for entry in result.schedule:
        writer.writerow(
            [
                entry.day,
                entry.slot,
                entry.subject_id,
                ";".join(entry.teacher_ids),
                ";".join(entry.group_ids),
                entry.room_id or "",
            ]
        )
    return buffer.getvalue()


def to_pretty_table(result: SolveResult, problem: TimetableProblem | None = None) -> str:
    """Render the schedule as one weekly grid per student group.

    Args:
        result: Solve result to render.
        problem: Optional problem for day ordering, slot labels, and group names.
            Without it, structure is inferred from the entries themselves.

    Returns:
        Plain-text rendering of one Rich table per group.
    """
    if not result.schedule:
        return f"No schedule (status: {result.status})\n"
    days = _day_order(result.schedule, problem)
    max_slot = max(entry.slot for entry in result.schedule)
    # markup=False: room labels like "[r101]" must render literally, not as Rich tags
    console = Console(record=True, width=140, force_terminal=False, markup=False)
    for group_id, group_name in _groups(result.schedule, problem):
        console.print(_group_table(result.schedule, group_id, group_name, days, max_slot, problem))
    return console.export_text()


def _group_table(
    schedule: list[ScheduleEntry],
    group_id: str,
    group_name: str,
    days: list[str],
    max_slot: int,
    problem: TimetableProblem | None,
) -> Table:
    """Build the weekly grid table for one student group."""
    cells: dict[tuple[str, int], str] = {}
    for entry in schedule:
        if group_id not in entry.group_ids:
            continue
        label = entry.subject_id + (f"\n[{entry.room_id}]" if entry.room_id else "")
        cells[(entry.day, entry.slot)] = label
    table = Table(title=group_name, show_lines=True)
    table.add_column("Slot", style="bold")
    for day in days:
        table.add_column(day)
    labels = problem.time_structure.slot_labels if problem else {}
    for slot in range(1, max_slot + 1):
        slot_name = labels.get(slot, str(slot))
        table.add_row(slot_name, *[cells.get((day, slot), "") for day in days])
    return table


def _day_order(schedule: list[ScheduleEntry], problem: TimetableProblem | None) -> list[str]:
    """Day columns: from the problem when given, else first-seen entry order."""
    if problem is not None:
        return list(problem.time_structure.days)
    seen: list[str] = []
    for entry in schedule:
        if entry.day not in seen:
            seen.append(entry.day)
    return seen


def _groups(
    schedule: list[ScheduleEntry], problem: TimetableProblem | None
) -> list[tuple[str, str]]:
    """(group_id, display name) pairs in stable order."""
    if problem is not None:
        return [(g.id, g.name) for g in problem.student_groups]
    seen: list[tuple[str, str]] = []
    for entry in schedule:
        for gid in entry.group_ids:
            if (gid, gid) not in seen:
                seen.append((gid, gid))
    return seen
