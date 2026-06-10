"""Tests for the independent quality scorer and violation detection."""

import pytest

from timetable_solver import score_schedule
from timetable_solver.models import (
    ConstraintsConfig,
    Room,
    ScheduleEntry,
    SoftConstraints,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)


def _entry(subject: str, day: str, slot: int, room: str | None = None) -> ScheduleEntry:
    return ScheduleEntry(
        subject_id=subject, day=day, slot=slot,
        teacher_ids=["t1"], group_ids=["g1"], room_id=room,
    )


@pytest.fixture
def two_subject_problem() -> TimetableProblem:
    """Two 1-hour subjects for one teacher and one group, 1 day x 4 slots."""
    return TimetableProblem(
        time_structure=TimeStructure(days=["Monday"], slots_per_day=4),
        teachers=[Teacher(id="t1", name="T")],
        student_groups=[StudentGroup(id="g1", name="G", size=20)],
        subjects=[
            Subject(id="s1", name="S1", hours_per_week=1, teacher_ids=["t1"], group_ids=["g1"]),
            Subject(id="s2", name="S2", hours_per_week=1, teacher_ids=["t1"], group_ids=["g1"]),
        ],
    )


class TestQualityScoring:
    def test_clean_schedule_scores_100(self, two_subject_problem: TimetableProblem) -> None:
        schedule = [_entry("s1", "Monday", 1), _entry("s2", "Monday", 2)]
        report = score_schedule(two_subject_problem, schedule)
        assert report.hard_violations == []
        assert report.overall_score == 100.0

    def test_gappy_schedule_scores_lower(self, two_subject_problem: TimetableProblem) -> None:
        adjacent = score_schedule(
            two_subject_problem, [_entry("s1", "Monday", 1), _entry("s2", "Monday", 2)]
        )
        gappy = score_schedule(
            two_subject_problem, [_entry("s1", "Monday", 1), _entry("s2", "Monday", 4)]
        )
        assert gappy.metrics["student_gaps"] < adjacent.metrics["student_gaps"]
        assert gappy.overall_score < adjacent.overall_score
        assert any("gap" in d for d in gappy.details.get("student_gaps", []))

    def test_weights_drive_overall_score(self, two_subject_problem: TimetableProblem) -> None:
        """With only student_gaps weighted, overall equals that metric exactly."""
        problem = two_subject_problem.model_copy(deep=True)
        problem.constraints = ConstraintsConfig(
            soft=SoftConstraints(minimize_student_gaps=80)
        )
        report = score_schedule(
            problem, [_entry("s1", "Monday", 1), _entry("s2", "Monday", 4)]
        )
        assert report.overall_score == report.metrics["student_gaps"]


class TestHardViolations:
    def test_teacher_double_booking_reported(
        self, two_subject_problem: TimetableProblem
    ) -> None:
        schedule = [_entry("s1", "Monday", 1), _entry("s2", "Monday", 1)]
        report = score_schedule(two_subject_problem, schedule)
        assert report.overall_score == 0.0
        assert any("double-booked" in v for v in report.hard_violations)

    def test_missing_hours_reported(self, two_subject_problem: TimetableProblem) -> None:
        report = score_schedule(two_subject_problem, [_entry("s1", "Monday", 1)])
        assert any("requires 1h" in v for v in report.hard_violations)
        assert any("'s2'" in v for v in report.hard_violations)

    def test_availability_violation_reported(self) -> None:
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Monday"], slots_per_day=4),
            teachers=[Teacher(id="t1", name="T", unavailable={"Monday": [1]})],
            student_groups=[StudentGroup(id="g1", name="G", size=20)],
            subjects=[
                Subject(id="s1", name="S", hours_per_week=1,
                        teacher_ids=["t1"], group_ids=["g1"]),
            ],
        )
        report = score_schedule(problem, [_entry("s1", "Monday", 1)])
        assert any("unavailable" in v for v in report.hard_violations)

    def test_room_clash_reported(self, two_subject_problem: TimetableProblem) -> None:
        problem = two_subject_problem.model_copy(deep=True)
        problem.rooms = [Room(id="r1", name="R", capacity=30)]
        # Different teachers/groups would be needed for a legal schedule, but the
        # scorer must flag the room clash independently of the other violations.
        schedule = [
            ScheduleEntry(subject_id="s1", day="Monday", slot=1,
                          teacher_ids=["t1"], group_ids=["g1"], room_id="r1"),
            ScheduleEntry(subject_id="s2", day="Monday", slot=1,
                          teacher_ids=["t2"], group_ids=["g2"], room_id="r1"),
        ]
        report = score_schedule(problem, schedule)
        assert any("Room 'r1' double-booked" in v for v in report.hard_violations)

    def test_max_per_day_violation_reported(
        self, two_subject_problem: TimetableProblem
    ) -> None:
        """Two hours of a max_per_day=1 subject on one day is flagged."""
        problem = two_subject_problem.model_copy(deep=True)
        problem.subjects[0].hours_per_week = 2
        schedule = [
            _entry("s1", "Monday", 1),
            _entry("s1", "Monday", 3),
            _entry("s2", "Monday", 2),
        ]
        report = score_schedule(problem, schedule)
        assert any("max_per_day" in v for v in report.hard_violations)

    def test_broken_lab_block_reported(self) -> None:
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Monday"], slots_per_day=4),
            teachers=[Teacher(id="t1", name="T")],
            student_groups=[StudentGroup(id="g1", name="G", size=20)],
            subjects=[
                Subject(id="lab", name="Lab", hours_per_week=2, type="lab",
                        teacher_ids=["t1"], group_ids=["g1"], consecutive_hours=2),
            ],
        )
        split = [_entry("lab", "Monday", 1), _entry("lab", "Monday", 3)]
        report = score_schedule(problem, split)
        assert any("contiguous" in v for v in report.hard_violations)

        contiguous = [_entry("lab", "Monday", 1), _entry("lab", "Monday", 2)]
        assert score_schedule(problem, contiguous).hard_violations == []
