"""Parameterized cross-entity rule instances (M7 constraint rule engine).

These are user-authored rules that have no natural home on a single entity
(Room/Subject/Teacher). They are collected under ConstraintsConfig.advanced and
consumed by the solver's rules_hard / rules_soft generators.
"""

from typing import Literal

from pydantic import BaseModel, Field


class GlobalBreak(BaseModel):
    """A day+slots window where nothing may be scheduled (rule 2).

    Args:
        day: Day name (must match a TimeStructure day).
        slots: 1-based slot numbers blocked on that day.
    """

    day: str = Field(min_length=1)
    slots: list[int] = Field(min_length=1)


class RoomReservation(BaseModel):
    """Restricts a room to a set of subjects (rule 24).

    Only subjects listed in subject_ids may use room_id; every other subject
    treats the room as unavailable. An empty subject_ids reserves the room for
    nobody (it becomes unusable).

    Args:
        room_id: The reserved room.
        subject_ids: Subjects permitted to use the room.
    """

    room_id: str = Field(min_length=1)
    subject_ids: list[str] = Field(default_factory=list)


class SubjectPair(BaseModel):
    """An ordered pair of subjects used by pairwise rules (22, 23).

    Args:
        first: First subject id.
        second: Second subject id.
    """

    first: str = Field(min_length=1)
    second: str = Field(min_length=1)


class GroupFreeHalfDay(BaseModel):
    """A half-day a group should be kept free (rule 15, soft).

    Args:
        group_id: The student group.
        day: Day name to keep partly free.
        half: Which half of the day to free.
    """

    group_id: str = Field(min_length=1)
    day: str = Field(min_length=1)
    half: Literal["morning", "afternoon"]


class AdvancedConstraints(BaseModel):
    """User-authored parameterized rules with no natural per-entity home.

    Every field defaults empty so existing problems are unaffected. Hard rules
    (breaks, reservations, caps, exclusions, orderings) are enforced by
    rules_hard; soft rules (same_room_subjects, group_free_halfdays) are weighted
    penalties in rules_soft, gated by the matching SoftConstraints weight.
    """

    global_breaks: list[GlobalBreak] = Field(default_factory=list)
    room_reservations: list[RoomReservation] = Field(default_factory=list)
    hard_teacher_daily_caps: dict[str, int] = Field(default_factory=dict)
    same_day_exclusions: list[SubjectPair] = Field(default_factory=list)
    orderings: list[SubjectPair] = Field(default_factory=list)
    same_room_subjects: list[str] = Field(default_factory=list)
    group_free_halfdays: list[GroupFreeHalfDay] = Field(default_factory=list)
