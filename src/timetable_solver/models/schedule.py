"""Schedule output models - solver results and individual entries."""

from typing import Literal

from pydantic import BaseModel, Field

SolverStatus = Literal["optimal", "feasible", "infeasible", "timeout"]


class ScheduleEntry(BaseModel):
    """A single scheduled event in the timetable.

    Args:
        subject_id: The subject assigned to this slot.
        day: Day name.
        slot: Slot number (1-indexed).
        teacher_ids: Teachers for this session.
        group_ids: Student groups attending.
        room_id: Assigned room (None if rooms not modeled).
    """

    subject_id: str
    day: str
    slot: int = Field(gt=0)
    teacher_ids: list[str]
    group_ids: list[str]
    room_id: str | None = None


class SolveResult(BaseModel):
    """Complete solver output.

    Args:
        status: Whether the solver found an optimal, feasible, or no solution.
        schedule: List of scheduled entries (empty if infeasible).
        quality_score: Overall schedule quality (0-100), None if not scored.
        solve_time_seconds: Wall-clock time the solver took.
        unresolved: Subjects that couldn't be placed (if any).
    """

    status: SolverStatus
    schedule: list[ScheduleEntry] = Field(default_factory=list)
    quality_score: float | None = None
    solve_time_seconds: float = 0.0
    unresolved: list[str] = Field(default_factory=list)
