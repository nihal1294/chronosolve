"""Tests for scoring/metrics_softened - preferences created by soften (M7.3).

The inverse-gate trio per kind: a softened, violated instance scores < 100
with a detail; the SAME violation un-softened stays 100 here (the hard check
owns it); a softened, honored instance scores 100.
"""

from timetable_solver.models import (
    ScheduleEntry,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)
from timetable_solver.scoring.metrics_softened import (
    softened_allowed_slots,
    softened_breaks,
    softened_orderings,
    softened_same_day,
    softened_teacher_caps,
)


def _problem(
    advanced: dict | None = None,
    softened: list[dict] | None = None,
    allowed_slots: list[int] | None = None,
) -> TimetableProblem:
    """Two-subject problem on a 2-day x 4-slot grid with advanced + softened rules."""
    merged = dict(advanced or {})
    merged["softened"] = softened or []
    return TimetableProblem(
        time_structure=TimeStructure(days=["Mon", "Tue"], slots_per_day=4),
        teachers=[Teacher(id="t1", name="A"), Teacher(id="t2", name="B")],
        student_groups=[StudentGroup(id="g1", name="G", size=30)],
        subjects=[
            Subject(
                id="math",
                name="Math",
                hours_per_week=2,
                teacher_ids=["t1"],
                group_ids=["g1"],
                allowed_slots=allowed_slots,
            ),
            Subject(id="phys", name="Phys", hours_per_week=2, teacher_ids=["t2"], group_ids=["g1"]),
        ],
        constraints={"advanced": merged},
    )


def _entry(subject: str, day: str, slot: int, teacher: str = "t1") -> ScheduleEntry:
    return ScheduleEntry(
        subject_id=subject, day=day, slot=slot, teacher_ids=[teacher], group_ids=["g1"]
    )


class TestSoftenedBreaks:
    ADVANCED = {"global_breaks": [{"day": "Mon", "slots": [2, 3]}]}
    SOFT = [{"kind": "break", "key": "0"}]

    def test_class_in_a_softened_break_scores_below_100(self) -> None:
        problem = _problem(self.ADVANCED, self.SOFT)
        score, details = softened_breaks(problem, [_entry("math", "Mon", 2)])
        assert score == 50.0  # one of the window's two slots hosts a class
        assert details

    def test_unsoftened_break_is_ignored_here(self) -> None:
        problem = _problem(self.ADVANCED)
        assert softened_breaks(problem, [_entry("math", "Mon", 2)])[0] == 100.0

    def test_honored_softened_break_scores_100(self) -> None:
        problem = _problem(self.ADVANCED, self.SOFT)
        assert softened_breaks(problem, [_entry("math", "Mon", 1)])[0] == 100.0


class TestSoftenedAllowedSlots:
    SOFT = [{"kind": "allowed_slots", "key": "math"}]

    def test_hours_outside_the_softened_window_score_below_100(self) -> None:
        problem = _problem(softened=self.SOFT, allowed_slots=[1, 2])
        schedule = [_entry("math", "Mon", 1), _entry("math", "Mon", 4)]
        score, details = softened_allowed_slots(problem, schedule)
        assert score == 50.0  # 1 of 2 scheduled hours outside
        assert details

    def test_unsoftened_subject_is_ignored_here(self) -> None:
        problem = _problem(allowed_slots=[1, 2])
        assert softened_allowed_slots(problem, [_entry("math", "Mon", 4)])[0] == 100.0

    def test_in_window_hours_score_100(self) -> None:
        problem = _problem(softened=self.SOFT, allowed_slots=[1, 2])
        assert softened_allowed_slots(problem, [_entry("math", "Mon", 1)])[0] == 100.0


class TestSoftenedTeacherCaps:
    ADVANCED = {"hard_teacher_daily_caps": {"t1": 1}}
    SOFT = [{"kind": "teacher_cap", "key": "t1"}]

    def test_day_over_a_softened_cap_scores_below_100(self) -> None:
        problem = _problem(self.ADVANCED, self.SOFT)
        schedule = [_entry("math", "Mon", 1), _entry("math", "Mon", 2)]
        score, details = softened_teacher_caps(problem, schedule)
        assert score == 50.0  # 1 overage hour of a 2-hour week
        assert details

    def test_unsoftened_cap_is_ignored_here(self) -> None:
        problem = _problem(self.ADVANCED)
        schedule = [_entry("math", "Mon", 1), _entry("math", "Mon", 2)]
        assert softened_teacher_caps(problem, schedule)[0] == 100.0

    def test_within_cap_scores_100(self) -> None:
        problem = _problem(self.ADVANCED, self.SOFT)
        schedule = [_entry("math", "Mon", 1), _entry("math", "Tue", 1)]
        assert softened_teacher_caps(problem, schedule)[0] == 100.0


class TestSoftenedSameDay:
    ADVANCED = {"same_day_exclusions": [{"first": "math", "second": "phys"}]}
    SOFT = [{"kind": "same_day", "key": "0"}]

    def test_shared_day_on_a_softened_pair_scores_below_100(self) -> None:
        problem = _problem(self.ADVANCED, self.SOFT)
        schedule = [_entry("math", "Mon", 1), _entry("phys", "Mon", 3, teacher="t2")]
        score, details = softened_same_day(problem, schedule)
        assert score == 0.0  # both appear on 1 day; 1 possible overlap day
        assert details

    def test_unsoftened_pair_is_ignored_here(self) -> None:
        problem = _problem(self.ADVANCED)
        schedule = [_entry("math", "Mon", 1), _entry("phys", "Mon", 3, teacher="t2")]
        assert softened_same_day(problem, schedule)[0] == 100.0

    def test_separate_days_score_100(self) -> None:
        problem = _problem(self.ADVANCED, self.SOFT)
        schedule = [_entry("math", "Mon", 1), _entry("phys", "Tue", 1, teacher="t2")]
        assert softened_same_day(problem, schedule)[0] == 100.0


class TestSoftenedOrderings:
    ADVANCED = {"orderings": [{"first": "math", "second": "phys"}]}
    SOFT = [{"kind": "ordering", "key": "0"}]

    def test_violated_softened_ordering_scores_0(self) -> None:
        problem = _problem(self.ADVANCED, self.SOFT)
        schedule = [_entry("math", "Mon", 3), _entry("phys", "Mon", 1, teacher="t2")]
        score, details = softened_orderings(problem, schedule)
        assert score == 0.0
        assert details

    def test_unsoftened_ordering_is_ignored_here(self) -> None:
        problem = _problem(self.ADVANCED)
        schedule = [_entry("math", "Mon", 3), _entry("phys", "Mon", 1, teacher="t2")]
        assert softened_orderings(problem, schedule)[0] == 100.0

    def test_honored_and_unscheduled_score_100(self) -> None:
        problem = _problem(self.ADVANCED, self.SOFT)
        honored = [_entry("math", "Mon", 1), _entry("phys", "Mon", 2, teacher="t2")]
        assert softened_orderings(problem, honored)[0] == 100.0
        # phys never scheduled -> instance skipped, like the CP-SAT builder
        assert softened_orderings(problem, [_entry("math", "Mon", 1)])[0] == 100.0
