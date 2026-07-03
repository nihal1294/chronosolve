"""Tests for scoring/violations_advanced - the scorer mirror of rules_hard.

Each kind gets the same trio: a violating schedule is flagged, the identical
schedule with the instance softened is NOT (metrics_softened prices it), and a
clean schedule passes.
"""

from timetable_solver.models import (
    ScheduleEntry,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)
from timetable_solver.scoring.grid import first_position, subject_day_slots
from timetable_solver.scoring.violations_advanced import find_advanced_violations


def _problem(
    advanced: dict | None = None, allowed_slots: list[int] | None = None
) -> TimetableProblem:
    """Two-subject problem on a 2-day x 4-slot grid with optional advanced rules."""
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
        constraints={"advanced": advanced or {}},
    )


def _entry(subject: str, day: str, slot: int, teacher: str = "t1") -> ScheduleEntry:
    return ScheduleEntry(
        subject_id=subject, day=day, slot=slot, teacher_ids=[teacher], group_ids=["g1"]
    )


class TestGridHelpers:
    def test_subject_day_slots_groups_and_sorts(self) -> None:
        grid = subject_day_slots([_entry("math", "Mon", 3), _entry("math", "Mon", 1)])
        assert grid == {("math", "Mon"): [1, 3]}

    def test_first_position_mirrors_the_solver_formula(self) -> None:
        grid = subject_day_slots([_entry("math", "Tue", 2)])
        # day_idx 1 * max_slots 4 + slot 2 = 6; absent subject -> None
        assert first_position(grid, "math", ["Mon", "Tue"], 4) == 6
        assert first_position(grid, "phys", ["Mon", "Tue"], 4) is None


class TestBreaks:
    def test_flags_entries_inside_an_unsoftened_break(self) -> None:
        problem = _problem({"global_breaks": [{"day": "Mon", "slots": [2]}]})
        violations = find_advanced_violations(problem, [_entry("math", "Mon", 2)])
        assert len(violations) == 1
        assert "break" in violations[0]

    def test_softened_break_is_not_a_hard_violation(self) -> None:
        problem = _problem(
            {
                "global_breaks": [{"day": "Mon", "slots": [2]}],
                "softened": [{"kind": "break", "key": "0"}],
            }
        )
        assert find_advanced_violations(problem, [_entry("math", "Mon", 2)]) == []

    def test_clean_schedule_passes(self) -> None:
        problem = _problem({"global_breaks": [{"day": "Mon", "slots": [2]}]})
        assert find_advanced_violations(problem, [_entry("math", "Mon", 3)]) == []


class TestAllowedSlots:
    def test_flags_hours_outside_the_window(self) -> None:
        problem = _problem(allowed_slots=[1, 2])
        violations = find_advanced_violations(problem, [_entry("math", "Mon", 3)])
        assert len(violations) == 1
        assert "allowed" in violations[0]

    def test_softened_subject_is_not_flagged(self) -> None:
        problem = _problem(
            {"softened": [{"kind": "allowed_slots", "key": "math"}]}, allowed_slots=[1, 2]
        )
        assert find_advanced_violations(problem, [_entry("math", "Mon", 3)]) == []

    def test_in_window_hours_pass(self) -> None:
        problem = _problem(allowed_slots=[1, 2])
        assert find_advanced_violations(problem, [_entry("math", "Mon", 2)]) == []


class TestTeacherCaps:
    def test_flags_a_day_over_the_cap(self) -> None:
        problem = _problem({"hard_teacher_daily_caps": {"t1": 1}})
        schedule = [_entry("math", "Mon", 1), _entry("math", "Mon", 2)]
        violations = find_advanced_violations(problem, schedule)
        assert len(violations) == 1
        assert "t1" in violations[0]

    def test_softened_cap_is_not_flagged(self) -> None:
        problem = _problem(
            {
                "hard_teacher_daily_caps": {"t1": 1},
                "softened": [{"kind": "teacher_cap", "key": "t1"}],
            }
        )
        schedule = [_entry("math", "Mon", 1), _entry("math", "Mon", 2)]
        assert find_advanced_violations(problem, schedule) == []

    def test_at_cap_passes(self) -> None:
        problem = _problem({"hard_teacher_daily_caps": {"t1": 2}})
        schedule = [_entry("math", "Mon", 1), _entry("math", "Mon", 2)]
        assert find_advanced_violations(problem, schedule) == []


class TestSameDay:
    def test_flags_a_shared_day(self) -> None:
        problem = _problem({"same_day_exclusions": [{"first": "math", "second": "phys"}]})
        schedule = [_entry("math", "Mon", 1), _entry("phys", "Mon", 3, teacher="t2")]
        violations = find_advanced_violations(problem, schedule)
        assert len(violations) == 1
        assert "Mon" in violations[0]

    def test_softened_pair_is_not_flagged(self) -> None:
        problem = _problem(
            {
                "same_day_exclusions": [{"first": "math", "second": "phys"}],
                "softened": [{"kind": "same_day", "key": "0"}],
            }
        )
        schedule = [_entry("math", "Mon", 1), _entry("phys", "Mon", 3, teacher="t2")]
        assert find_advanced_violations(problem, schedule) == []

    def test_separate_days_pass(self) -> None:
        problem = _problem({"same_day_exclusions": [{"first": "math", "second": "phys"}]})
        schedule = [_entry("math", "Mon", 1), _entry("phys", "Tue", 1, teacher="t2")]
        assert find_advanced_violations(problem, schedule) == []


class TestOrderings:
    def test_flags_second_starting_at_or_before_first(self) -> None:
        problem = _problem({"orderings": [{"first": "math", "second": "phys"}]})
        schedule = [_entry("math", "Mon", 3), _entry("phys", "Mon", 1, teacher="t2")]
        violations = find_advanced_violations(problem, schedule)
        assert len(violations) == 1
        assert "before" in violations[0]

    def test_softened_ordering_is_not_flagged(self) -> None:
        problem = _problem(
            {
                "orderings": [{"first": "math", "second": "phys"}],
                "softened": [{"kind": "ordering", "key": "0"}],
            }
        )
        schedule = [_entry("math", "Mon", 3), _entry("phys", "Mon", 1, teacher="t2")]
        assert find_advanced_violations(problem, schedule) == []

    def test_honored_order_passes_and_absent_subject_is_skipped(self) -> None:
        problem = _problem({"orderings": [{"first": "math", "second": "phys"}]})
        honored = [_entry("math", "Mon", 1), _entry("phys", "Mon", 2, teacher="t2")]
        assert find_advanced_violations(problem, honored) == []
        # phys never scheduled -> the rule is skipped, like the CP-SAT builder
        assert find_advanced_violations(problem, [_entry("math", "Mon", 3)]) == []
