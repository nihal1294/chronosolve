"""Tests for Pydantic data models - valid construction and validation errors."""

import pytest
from pydantic import ValidationError

from timetable_solver.models import (
    ConstraintsConfig,
    PreAssignment,
    Room,
    ScheduleEntry,
    SoftConstraints,
    SolveResult,
    Subject,
    Teacher,
    TeacherPreferences,
    TimeStructure,
)


class TestTimeStructure:
    def test_valid_construction(self) -> None:
        ts = TimeStructure(days=["Mon", "Tue"], slots_per_day=6)
        assert ts.get_slots_for_day("Mon") == 6
        assert ts.total_slots() == 12

    def test_slot_overrides(self) -> None:
        ts = TimeStructure(
            days=["Mon", "Tue", "Sat"],
            slots_per_day=8,
            slot_overrides={"Sat": 4},
        )
        assert ts.get_slots_for_day("Mon") == 8
        assert ts.get_slots_for_day("Sat") == 4
        assert ts.total_slots() == 20

    def test_override_invalid_day_rejected(self) -> None:
        with pytest.raises(ValidationError, match="unknown days"):
            TimeStructure(
                days=["Mon", "Tue"],
                slots_per_day=6,
                slot_overrides={"Sunday": 4},
            )

    def test_empty_days_rejected(self) -> None:
        with pytest.raises(ValidationError):
            TimeStructure(days=[], slots_per_day=6)

    def test_zero_slots_rejected(self) -> None:
        with pytest.raises(ValidationError):
            TimeStructure(days=["Mon"], slots_per_day=0)


class TestRoom:
    def test_valid_room(self) -> None:
        room = Room(id="r1", name="Room 101", capacity=50)
        assert room.type == "any"

    def test_zero_capacity_rejected(self) -> None:
        with pytest.raises(ValidationError):
            Room(id="r1", name="Room 101", capacity=0)

    def test_empty_id_rejected(self) -> None:
        with pytest.raises(ValidationError):
            Room(id="", name="Room 101", capacity=50)


class TestTeacher:
    def test_valid_teacher(self) -> None:
        t = Teacher(id="t1", name="Dr. Smith")
        assert t.unavailable == {}
        assert t.preferences is None

    def test_with_preferences(self) -> None:
        prefs = TeacherPreferences(max_hours_per_day=5, schedule_style="compact")
        t = Teacher(id="t1", name="Dr. Smith", preferences=prefs)
        assert t.preferences is not None
        assert t.preferences.max_hours_per_day == 5

    def test_max_consecutive_requires_prefer(self) -> None:
        with pytest.raises(ValidationError, match="max_consecutive"):
            TeacherPreferences(max_consecutive=3, consecutive_hours="avoid")

    def test_max_consecutive_with_prefer_ok(self) -> None:
        prefs = TeacherPreferences(consecutive_hours="prefer", max_consecutive=3)
        assert prefs.max_consecutive == 3


class TestSubject:
    def test_valid_subject(self) -> None:
        s = Subject(
            id="math",
            name="Mathematics",
            hours_per_week=4,
            teacher_ids=["t1"],
            group_ids=["g1"],
        )
        assert s.type == "theory"
        assert s.max_per_day == 1

    def test_lab_with_consecutive(self) -> None:
        s = Subject(
            id="lab1",
            name="CS Lab",
            hours_per_week=4,
            type="lab",
            teacher_ids=["t1"],
            group_ids=["g1"],
            consecutive_hours=2,
        )
        assert s.consecutive_hours == 2

    def test_consecutive_not_divisible_rejected(self) -> None:
        with pytest.raises(ValidationError, match="divisible"):
            Subject(
                id="lab1",
                name="Lab",
                hours_per_week=3,
                teacher_ids=["t1"],
                group_ids=["g1"],
                consecutive_hours=2,
            )

    def test_empty_teacher_ids_rejected(self) -> None:
        with pytest.raises(ValidationError):
            Subject(
                id="s1",
                name="Subject",
                hours_per_week=2,
                teacher_ids=[],
                group_ids=["g1"],
            )


class TestPreAssignment:
    def test_valid(self) -> None:
        pa = PreAssignment(subject_id="math", day="Monday", slot=1)
        assert pa.slot == 1

    def test_zero_slot_rejected(self) -> None:
        with pytest.raises(ValidationError):
            PreAssignment(subject_id="math", day="Monday", slot=0)


class TestConstraints:
    def test_defaults(self) -> None:
        config = ConstraintsConfig()
        assert config.hard.teacher_no_clash is True
        assert config.soft.minimize_student_gaps == 0

    def test_soft_weight_bounds(self) -> None:
        with pytest.raises(ValidationError):
            SoftConstraints(minimize_student_gaps=101)
        with pytest.raises(ValidationError):
            SoftConstraints(minimize_student_gaps=-1)


class TestScheduleModels:
    def test_schedule_entry(self) -> None:
        entry = ScheduleEntry(
            subject_id="math",
            day="Monday",
            slot=1,
            teacher_ids=["t1"],
            group_ids=["g1"],
        )
        assert entry.room_id is None

    def test_solve_result_defaults(self) -> None:
        result = SolveResult(status="infeasible")
        assert result.schedule == []
        assert result.quality_score is None
        assert result.solve_time_seconds == 0.0
