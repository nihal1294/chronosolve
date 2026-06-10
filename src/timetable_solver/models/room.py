"""Room model — optional physical space assignments."""

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
    """

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    capacity: int = Field(gt=0)
    type: RoomType = "any"
