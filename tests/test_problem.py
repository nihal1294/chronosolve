"""TimetableProblem cross-reference validation tests."""

import pytest
from pydantic import ValidationError

from timetable_solver.models import (
    PreAssignment,
    Room,
    StudentGroup,
    Subject,
    Teacher,
    TeacherPreferences,
    TimeStructure,
    TimetableProblem,
)


def _subject(**overrides) -> Subject:
    defaults = dict(id="s1", name="Sub", hours_per_week=2, teacher_ids=["t1"], group_ids=["g1"])
    return Subject(**{**defaults, **overrides})


def _problem(minimal_time_structure: TimeStructure, **overrides) -> TimetableProblem:
    defaults = dict(
        time_structure=minimal_time_structure,
        teachers=[Teacher(id="t1", name="Smith")],
        student_groups=[StudentGroup(id="g1", name="A", size=30)],
        subjects=[_subject()],
    )
    return TimetableProblem(**{**defaults, **overrides})


class TestTimetableProblem:
    def test_minimal_valid(self, minimal_problem: TimetableProblem) -> None:
        assert len(minimal_problem.subjects) == 1
        assert minimal_problem.constraints.hard.teacher_no_clash is True

    def test_unknown_teacher_id_rejected(
        self, minimal_time_structure: TimeStructure
    ) -> None:
        with pytest.raises(ValidationError, match="unknown teacher_id"):
            _problem(
                minimal_time_structure,
                subjects=[_subject(teacher_ids=["t_nonexistent"])],
            )

    def test_unknown_group_id_rejected(
        self, minimal_time_structure: TimeStructure
    ) -> None:
        with pytest.raises(ValidationError, match="unknown group_id"):
            _problem(
                minimal_time_structure,
                subjects=[_subject(group_ids=["g_nonexistent"])],
            )

    def test_pre_assignment_invalid_day_rejected(
        self, minimal_time_structure: TimeStructure
    ) -> None:
        with pytest.raises(ValidationError, match="unknown day"):
            _problem(
                minimal_time_structure,
                pre_assignments=[PreAssignment(subject_id="s1", day="Sunday", slot=1)],
            )

    def test_pre_assignment_slot_exceeds_max(
        self, minimal_time_structure: TimeStructure
    ) -> None:
        with pytest.raises(ValidationError, match="exceeds max"):
            _problem(
                minimal_time_structure,
                pre_assignments=[PreAssignment(subject_id="s1", day="Monday", slot=99)],
            )

    def test_pre_assigned_block_overflowing_day_rejected(
        self, minimal_time_structure: TimeStructure
    ) -> None:
        """A consecutive block starting too late to fit in the day is an error."""
        lab = _subject(id="lab1", type="lab", consecutive_hours=2)
        with pytest.raises(ValidationError, match="consecutive slots"):
            # Day has 4 slots; a 2-hour block starting at slot 4 needs slot 5.
            _problem(
                minimal_time_structure,
                subjects=[lab],
                pre_assignments=[PreAssignment(subject_id="lab1", day="Monday", slot=4)],
            )

    def test_pre_assigned_block_fitting_day_accepted(
        self, minimal_time_structure: TimeStructure
    ) -> None:
        """A consecutive block that ends exactly at the last slot is valid."""
        lab = _subject(id="lab1", type="lab", consecutive_hours=2)
        problem = _problem(
            minimal_time_structure,
            subjects=[lab],
            pre_assignments=[PreAssignment(subject_id="lab1", day="Monday", slot=3)],
        )
        assert problem.pre_assignments[0].slot == 3

    def test_unavailable_unknown_day_rejected(
        self, minimal_time_structure: TimeStructure
    ) -> None:
        with pytest.raises(ValidationError, match="unknown day"):
            _problem(
                minimal_time_structure,
                teachers=[Teacher(id="t1", name="Smith", unavailable={"Sunday": [1]})],
            )

    def test_preference_unknown_day_rejected(
        self, minimal_time_structure: TimeStructure
    ) -> None:
        """slot_preferences/leave_early days are validated like unavailable days."""
        prefs = TeacherPreferences(leave_early={"Sunday": 2})
        with pytest.raises(ValidationError, match="preferences reference unknown day"):
            _problem(
                minimal_time_structure,
                teachers=[Teacher(id="t1", name="Smith", preferences=prefs)],
            )

    def test_with_rooms_valid(self, problem_with_rooms: TimetableProblem) -> None:
        assert len(problem_with_rooms.rooms) == 2

    def test_invalid_room_type_rejected(
        self, minimal_time_structure: TimeStructure
    ) -> None:
        with pytest.raises(ValidationError, match="preferred_room_type"):
            _problem(
                minimal_time_structure,
                subjects=[_subject(preferred_room_type="lab")],
                rooms=[Room(id="r1", name="Room", capacity=50, type="lecture")],
            )
