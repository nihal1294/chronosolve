"""Subject model — an event that needs scheduling (theory, lab, or elective)."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from timetable_solver.models.room import RoomType

SubjectType = Literal["theory", "lab", "elective"]


class Subject(BaseModel):
    """A course or lab session to be scheduled.

    Args:
        id: Unique identifier (e.g., "DAA", "DAA-LAB").
        name: Full name.
        short_name: Optional abbreviated name for display.
        hours_per_week: Total hours to schedule per week.
        type: Classification affecting scheduling behavior.
        teacher_ids: Teachers assigned to this subject.
        group_ids: Student groups attending this subject.
        max_per_day: Maximum occurrences on any single day (default 1).
        consecutive_hours: If set, must be scheduled in a contiguous block of this size.
        preferred_room_type: Optional room type requirement.
    """

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    short_name: str | None = None
    hours_per_week: int = Field(gt=0)
    type: SubjectType = "theory"
    teacher_ids: list[str] = Field(min_length=1)
    group_ids: list[str] = Field(min_length=1)
    max_per_day: int = Field(default=1, gt=0)
    consecutive_hours: int | None = Field(default=None, gt=0)
    preferred_room_type: RoomType | None = None

    @model_validator(mode="after")
    def _validate_consecutive_divides_hours(self) -> "Subject":
        if self.consecutive_hours is not None:
            if self.hours_per_week % self.consecutive_hours != 0:
                msg = (
                    f"hours_per_week ({self.hours_per_week}) must be divisible "
                    f"by consecutive_hours ({self.consecutive_hours})"
                )
                raise ValueError(msg)
        return self
