"""Student group model - a section or cohort that takes classes together."""

from pydantic import BaseModel, ConfigDict, Field


class StudentGroup(BaseModel):
    """A group of students that shares a common timetable.

    Args:
        id: Unique identifier (e.g., "CS-4A").
        name: Human-readable name (e.g., "CS 4th Sem Section A").
        size: Number of students in the group.
        unavailable: Hard-blocked slots per day (e.g., {"Thursday": [6, 7, 8]}).
        max_hours_per_day: Optional cap on daily class hours.
        department: Optional grouping label (e.g., "CSE"); reporting only.
        semester: Optional grouping label (e.g., "3"); reporting only.
    """

    # department/semester are presentation/reporting metadata used by the app to
    # group and filter timetables - the solver ignores them. Numbers in YAML
    # (semester: 3) are coerced to strings so they don't fail validation.
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    size: int = Field(gt=0)
    unavailable: dict[str, list[int]] = Field(default_factory=dict)
    max_hours_per_day: int | None = Field(default=None, gt=0)
    department: str | None = Field(default=None)
    semester: str | None = Field(default=None)
