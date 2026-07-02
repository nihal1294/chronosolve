"""Constraint configuration - hard (inviolable) and soft (weighted preferences)."""

from pydantic import BaseModel, Field

from timetable_solver.models.rules import AdvancedConstraints


class HardConstraints(BaseModel):
    """Hard constraints that must be satisfied for a valid schedule.

    Args:
        teacher_no_clash: No teacher assigned to overlapping slots.
        group_no_clash: No student group in overlapping slots.
        room_no_clash: No room double-booked (only if rooms provided).
        respect_availability: Honor teacher/group unavailable slots.
        required_hours: Each subject gets its exact hours_per_week.
        room_capacity: Exclude rooms too small for a subject's groups (rule 25);
            opt-in (default False) so existing problems are unaffected.
    """

    teacher_no_clash: bool = True
    group_no_clash: bool = True
    room_no_clash: bool = True
    respect_availability: bool = True
    required_hours: bool = True
    room_capacity: bool = False


class SoftConstraints(BaseModel):
    """Soft constraints with weights (0 = disabled, 1-100 = priority).

    Higher weight means the solver tries harder to satisfy this preference.
    """

    minimize_student_gaps: int = Field(default=0, ge=0, le=100)
    minimize_teacher_gaps: int = Field(default=0, ge=0, le=100)
    spread_subjects: int = Field(default=0, ge=0, le=100)
    teacher_time_preferences: int = Field(default=0, ge=0, le=100)
    compact_schedules: int = Field(default=0, ge=0, le=100)
    avoid_consecutive_hours: int = Field(default=0, ge=0, le=100)
    leave_early: int = Field(default=0, ge=0, le=100)
    max_hours_per_day: int = Field(default=0, ge=0, le=100)
    free_days: int = Field(default=0, ge=0, le=100)
    workload_balance: int = Field(default=0, ge=0, le=100)
    group_workload_balance: int = Field(default=0, ge=0, le=100)
    avoid_consecutive_labs: int = Field(default=0, ge=0, le=100)
    same_room: int = Field(default=0, ge=0, le=100)
    group_free_halfday: int = Field(default=0, ge=0, le=100)
    # M7.3 - soft counterparts of the 5 gated hard rules (set by the soften action)
    soft_break: int = Field(default=0, ge=0, le=100)
    soft_allowed_slots: int = Field(default=0, ge=0, le=100)
    soft_teacher_cap: int = Field(default=0, ge=0, le=100)
    soft_same_day: int = Field(default=0, ge=0, le=100)
    soft_ordering: int = Field(default=0, ge=0, le=100)


class ConstraintsConfig(BaseModel):
    """Top-level constraints configuration combining hard, soft, and advanced rules."""

    hard: HardConstraints = Field(default_factory=HardConstraints)
    soft: SoftConstraints = Field(default_factory=SoftConstraints)
    advanced: AdvancedConstraints = Field(default_factory=AdvancedConstraints)
