"""Time structure configuration - days, slots, and labels."""

from pydantic import BaseModel, Field, model_validator


class TimeStructure(BaseModel):
    """Configurable time grid for the timetable.

    Args:
        days: Ordered list of day names (e.g., ["Monday", "Tuesday", ...]).
        slots_per_day: Default number of slots for each day.
        slot_overrides: Per-day slot count overrides (e.g., {"Saturday": 4}).
        slot_labels: Optional display labels for slot numbers (e.g., {1: "9:00 - 9:55"}).
    """

    days: list[str] = Field(min_length=1)
    slots_per_day: int = Field(gt=0)
    slot_overrides: dict[str, int] = Field(default_factory=dict)
    slot_labels: dict[int, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate_overrides_reference_valid_days(self) -> "TimeStructure":
        invalid = set(self.slot_overrides.keys()) - set(self.days)
        if invalid:
            msg = f"slot_overrides reference unknown days: {sorted(invalid)}"
            raise ValueError(msg)
        for day, count in self.slot_overrides.items():
            if count <= 0:
                msg = f"slot_overrides[{day!r}] must be positive, got {count}"
                raise ValueError(msg)
        return self

    def get_slots_for_day(self, day: str) -> int:
        """Return the number of slots for a specific day."""
        return self.slot_overrides.get(day, self.slots_per_day)

    def total_slots(self) -> int:
        """Return the total number of slots across all days."""
        return sum(self.get_slots_for_day(d) for d in self.days)


def halfday_slots(slot_count: int, half: str) -> range:
    """Slot numbers in a day's morning or afternoon (morning is the lower half).

    For an odd slot count the morning takes the extra slot (5 slots -> morning
    [1,2,3], afternoon [4,5]); a 1-slot day has an empty afternoon. Shared by
    the solver's soft builders and the scorer so both agree on what "half-day"
    means.

    Args:
        slot_count: Number of slots in the day.
        half: "morning" or "afternoon".

    Returns:
        The 1-based slot numbers in that half (possibly empty).
    """
    mid = (slot_count + 1) // 2
    if half == "morning":
        return range(1, mid + 1)
    return range(mid + 1, slot_count + 1)
