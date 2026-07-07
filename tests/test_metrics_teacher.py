"""Tests for scoring/metrics_teacher - the 4 base TeacherPreferences metrics (M7.5).

Directional contract per metric (mirrors solver/soft_teacher.py terms):
a violating schedule scores below an honoring one; fully honored == 100;
nothing configured == vacuous 100; teachers without the preference are
excluded from the mean.
"""

import pytest

from timetable_solver.models import (
    ScheduleEntry,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)
from timetable_solver.models.teacher import TeacherPreferences
from timetable_solver.scoring.metrics_teacher import (
    consecutive_hours,
    free_days,
    leave_early,
    max_daily_hours,
)

DAYS = ["Mon", "Tue", "Wed"]


def _problem(
    prefs: TeacherPreferences | None = None,
    second_teacher: bool = False,
) -> TimetableProblem:
    """One preference-carrying teacher (t1) on a 3-day x 4-slot grid.

    Args:
        prefs: Preferences for t1 (None = no preferences).
        second_teacher: Add preference-less t2 with their own subject.
    """
    teachers = [Teacher(id="t1", name="A", preferences=prefs)]
    subjects = [
        Subject(id="math", name="Math", hours_per_week=2, teacher_ids=["t1"], group_ids=["g1"])
    ]
    if second_teacher:
        teachers.append(Teacher(id="t2", name="B"))
        subjects.append(
            Subject(id="eng", name="Eng", hours_per_week=3, teacher_ids=["t2"], group_ids=["g1"])
        )
    return TimetableProblem(
        time_structure=TimeStructure(days=DAYS, slots_per_day=4),
        teachers=teachers,
        student_groups=[StudentGroup(id="g1", name="G", size=30)],
        subjects=subjects,
    )


def _entry(day: str, slot: int, subject: str = "math", teacher: str = "t1") -> ScheduleEntry:
    return ScheduleEntry(
        subject_id=subject, day=day, slot=slot, teacher_ids=[teacher], group_ids=["g1"]
    )


class TestFreeDays:
    def test_met_scores_100_with_no_details(self) -> None:
        problem = _problem(TeacherPreferences(min_free_days=2))
        schedule = [_entry("Mon", 1), _entry("Mon", 2)]  # Tue + Wed free
        score, details = free_days(problem, schedule)
        assert score == 100.0
        assert details == []

    def test_shortfall_lowers_score_and_names_teacher(self) -> None:
        problem = _problem(TeacherPreferences(min_free_days=2))
        schedule = [_entry("Mon", 1), _entry("Tue", 1)]  # only Wed free: 1 of 2
        score, details = free_days(problem, schedule)
        assert score == 50.0
        assert any("t1" in d for d in details)

    def test_teacher_without_pref_is_excluded(self) -> None:
        problem = _problem(TeacherPreferences(min_free_days=2), second_teacher=True)
        schedule = [
            _entry("Mon", 1),
            _entry("Mon", 2),
            # t2 teaches every day but has no preference - must not dilute t1's 100
            _entry("Mon", 3, subject="eng", teacher="t2"),
            _entry("Tue", 1, subject="eng", teacher="t2"),
            _entry("Wed", 1, subject="eng", teacher="t2"),
        ]
        score, _ = free_days(problem, schedule)
        assert score == 100.0

    def test_nothing_configured_is_vacuous_100(self) -> None:
        problem = _problem(prefs=None)
        schedule = [_entry("Mon", 1), _entry("Tue", 1), _entry("Wed", 1)]
        score, details = free_days(problem, schedule)
        assert score == 100.0
        assert details == []


class TestConsecutiveAvoid:
    def test_fully_clustered_scores_0(self) -> None:
        problem = _problem(TeacherPreferences(consecutive_hours="avoid"))
        # {1,2,3}: pairs = 2, worst possible for 3 slots = 2
        schedule = [_entry("Mon", 1), _entry("Mon", 2), _entry("Mon", 3)]
        score, details = consecutive_hours(problem, schedule)
        assert score == 0.0
        assert any("t1" in d for d in details)

    def test_no_adjacent_pairs_scores_100(self) -> None:
        problem = _problem(TeacherPreferences(consecutive_hours="avoid"))
        schedule = [_entry("Mon", 1), _entry("Mon", 3), _entry("Tue", 1)]
        score, details = consecutive_hours(problem, schedule)
        assert score == 100.0
        assert details == []

    def test_single_hour_days_cannot_violate(self) -> None:
        problem = _problem(TeacherPreferences(consecutive_hours="avoid"))
        schedule = [_entry("Mon", 1), _entry("Tue", 4)]
        score, _ = consecutive_hours(problem, schedule)
        assert score == 100.0


class TestConsecutivePrefer:
    def test_direction_flip_clustered_wins(self) -> None:
        """The same schedules score opposite under prefer vs avoid."""
        problem = _problem(TeacherPreferences(consecutive_hours="prefer"))
        clustered = [_entry("Mon", 1), _entry("Mon", 2), _entry("Mon", 3)]
        spread = [_entry("Mon", 1), _entry("Mon", 3), _entry("Tue", 1)]
        assert consecutive_hours(problem, clustered)[0] == 100.0
        assert consecutive_hours(problem, spread)[0] == 0.0

    def test_run_over_cap_halves_score(self) -> None:
        problem = _problem(TeacherPreferences(consecutive_hours="prefer", max_consecutive=2))
        # {1,2,3,4}: pairs=3, excess windows of 3 = 2, best = 4 - ceil(4/2) = 2 -> 50
        schedule = [_entry("Mon", s) for s in (1, 2, 3, 4)]
        score, details = consecutive_hours(problem, schedule)
        assert score == 50.0
        assert any("t1" in d for d in details)

    def test_runs_packed_at_cap_score_100(self) -> None:
        problem = _problem(TeacherPreferences(consecutive_hours="prefer", max_consecutive=2))
        schedule = [_entry("Mon", 1), _entry("Mon", 2), _entry("Tue", 1), _entry("Tue", 2)]
        score, details = consecutive_hours(problem, schedule)
        assert score == 100.0
        assert details == []


class TestLeaveEarly:
    def test_all_classes_by_cutoff_scores_100(self) -> None:
        problem = _problem(TeacherPreferences(leave_early={"Mon": 2}))
        schedule = [_entry("Mon", 1), _entry("Mon", 2)]
        score, details = leave_early(problem, schedule)
        assert score == 100.0
        assert details == []

    def test_late_hours_lower_score_proportionally(self) -> None:
        problem = _problem(TeacherPreferences(leave_early={"Mon": 2}))
        # capacity = 4 slots - cutoff 2 = 2; one late hour (slot 4) -> 50
        schedule = [_entry("Mon", 1), _entry("Mon", 4)]
        score, details = leave_early(problem, schedule)
        assert score == 50.0
        assert any("t1" in d and "Mon" in d for d in details)

    def test_unconfigured_days_do_not_count(self) -> None:
        problem = _problem(TeacherPreferences(leave_early={"Mon": 2}))
        schedule = [_entry("Tue", 4)]  # late slot, but Tue has no cutoff
        score, details = leave_early(problem, schedule)
        assert score == 100.0
        assert details == []


class TestMaxDailyHours:
    def test_under_cap_everywhere_scores_100(self) -> None:
        problem = _problem(TeacherPreferences(max_hours_per_day=2))
        schedule = [_entry("Mon", 1), _entry("Mon", 2)]  # exactly at cap, no excess
        score, details = max_daily_hours(problem, schedule)
        assert score == 100.0
        assert details == []

    def test_excess_hours_lower_score_proportionally(self) -> None:
        problem = _problem(TeacherPreferences(max_hours_per_day=1))
        # Monday has 3 hours: excess 2; capacity = 3 days x (4 slots - cap 1) = 9
        schedule = [_entry("Mon", 1), _entry("Mon", 2), _entry("Mon", 3)]
        score, details = max_daily_hours(problem, schedule)
        assert score == pytest.approx(100.0 * (1 - 2 / 9))
        assert any("t1" in d and "Mon" in d for d in details)

    def test_cap_at_day_capacity_cannot_be_violated(self) -> None:
        problem = _problem(TeacherPreferences(max_hours_per_day=4))
        schedule = [_entry("Mon", s) for s in (1, 2, 3, 4)]
        score, details = max_daily_hours(problem, schedule)
        assert score == 100.0
        assert details == []
