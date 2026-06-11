"""Student group model - a section or cohort that takes classes together."""

from pydantic import BaseModel, Field


class StudentGroup(BaseModel):
    """A group of students that shares a common timetable.

    Args:
        id: Unique identifier (e.g., "CS-4A").
        name: Human-readable name (e.g., "CS 4th Sem Section A").
        size: Number of students in the group.
        unavailable: Hard-blocked slots per day (e.g., {"Thursday": [6, 7, 8]}).
        max_hours_per_day: Optional cap on daily class hours.
    """

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    size: int = Field(gt=0)
    unavailable: dict[str, list[int]] = Field(default_factory=dict)
    max_hours_per_day: int | None = Field(default=None, gt=0)
