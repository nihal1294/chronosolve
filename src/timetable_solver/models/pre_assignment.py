"""Pre-assignment model — events fixed to specific timeslots."""

from pydantic import BaseModel, Field


class PreAssignment(BaseModel):
    """A subject pinned to a specific day and slot before solving.

    Args:
        subject_id: The subject to fix.
        day: The day name (must match a day in TimeStructure).
        slot: The slot number (1-indexed).
    """

    subject_id: str = Field(min_length=1)
    day: str = Field(min_length=1)
    slot: int = Field(gt=0)
