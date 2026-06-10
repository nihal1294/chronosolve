"""Teacher model — availability, preferences, and scheduling constraints."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

SlotPreference = Literal["preferred", "avoid"]
ScheduleStyle = Literal["compact", "spread"]
ConsecutivePreference = Literal["avoid", "prefer"]


class TeacherPreferences(BaseModel):
    """Soft scheduling preferences for a teacher (all optional, all weighted).

    Args:
        slot_preferences: Per-day slot preferences (e.g., {"Monday": {1: "preferred", 8: "avoid"}}).
        max_hours_per_day: Soft cap on daily teaching hours.
        min_free_days: Desired number of completely free days per week.
        schedule_style: Whether to cluster ("compact") or spread classes.
        consecutive_hours: Preference for back-to-back classes.
        max_consecutive: Max consecutive teaching hours (when consecutive_hours="prefer").
        leave_early: Per-day cutoff slot — penalize classes after this slot.
    """

    slot_preferences: dict[str, dict[int, SlotPreference]] = Field(default_factory=dict)
    max_hours_per_day: int | None = Field(default=None, gt=0)
    min_free_days: int | None = Field(default=None, ge=0)
    schedule_style: ScheduleStyle | None = None
    consecutive_hours: ConsecutivePreference | None = None
    max_consecutive: int | None = Field(default=None, gt=0)
    leave_early: dict[str, int] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate_max_consecutive_requires_prefer(self) -> "TeacherPreferences":
        if self.max_consecutive is not None and self.consecutive_hours != "prefer":
            msg = "max_consecutive only applies when consecutive_hours='prefer'"
            raise ValueError(msg)
        return self


class Teacher(BaseModel):
    """A teacher with hard availability and soft preferences.

    Args:
        id: Unique identifier.
        name: Human-readable name.
        unavailable: Hard-blocked slots per day (e.g., {"Monday": [5, 6]}).
        preferences: Optional soft scheduling preferences.
    """

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    unavailable: dict[str, list[int]] = Field(default_factory=dict)
    preferences: TeacherPreferences | None = None
