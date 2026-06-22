"""Room model - optional physical space assignments."""

from typing import Literal

from pydantic import BaseModel, Field

RoomType = Literal["lecture", "lab", "any"]


class Room(BaseModel):
    """A physical room or lab available for scheduling.

    Args:
        id: Unique identifier.
        name: Human-readable name.
        capacity: Maximum student count.
        type: Room classification for matching with subject requirements.
        tags: Free-form capability labels (e.g. "gpu", "projector"); a subject
            with required_tags may only use rooms whose tags cover them.
    """

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    capacity: int = Field(gt=0)
    type: RoomType = "any"
    tags: set[str] = Field(default_factory=set)


def room_type_matches(room_type: RoomType, preference: RoomType | None) -> bool:
    """True when a room of room_type satisfies a subject's preferred_room_type.

    Shared by solver variable creation and schedule scoring so both treat
    type compatibility as the same hard rule. No/"any" preference matches all
    rooms; otherwise the room must have the preferred type or be multi-purpose.
    """
    if preference is None or preference == "any":
        return True
    return room_type in (preference, "any")
