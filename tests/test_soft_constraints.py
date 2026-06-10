"""Soft constraint tests — each penalty provably shapes the optimal solution.

Every test builds a problem where satisfying the preference costs nothing,
asserts the solve is proven optimal, then asserts the preferred property.
At a proven optimum the property is guaranteed, so these are deterministic.
"""

from timetable_solver import load_problem, solve
from timetable_solver.models import (
    ConstraintsConfig,
    SoftConstraints,
    StudentGroup,
    Subject,
    Teacher,
    TeacherPreferences,
    TimeStructure,
    TimetableProblem,
)
from timetable_solver.models.schedule import SolveResult


def _problem(
    teacher: Teacher,
    subjects: list[Subject],
    days: list[str],
    slots: int,
    **soft_weights: int,
) -> TimetableProblem:
    return TimetableProblem(
        time_structure=TimeStructure(days=days, slots_per_day=slots),
        teachers=[teacher],
        student_groups=[StudentGroup(id="g1", name="G", size=20)],
        subjects=subjects,
        constraints=ConstraintsConfig(soft=SoftConstraints(**soft_weights)),
    )


def _subject(sid: str = "s1", hours: int = 2, max_per_day: int = 2) -> Subject:
    return Subject(
        id=sid, name=sid, hours_per_week=hours, max_per_day=max_per_day,
        teacher_ids=["t1"], group_ids=["g1"],
    )


def _optimal(problem: TimetableProblem) -> SolveResult:
    result = solve(problem, time_limit=15)
    assert result.status == "optimal"
    return result


class TestSlotPreferences:
    def test_avoided_slots_stay_empty_when_alternatives_exist(self) -> None:
        teacher = Teacher(
            id="t1", name="T",
            preferences=TeacherPreferences(
                slot_preferences={"Monday": {1: "avoid", 2: "avoid"}}
            ),
        )
        problem = _problem(
            teacher, [_subject()], ["Monday"], slots=4, teacher_time_preferences=100
        )
        result = _optimal(problem)
        assert sorted(e.slot for e in result.schedule) == [3, 4]


class TestGapMinimization:
    def test_student_hours_are_adjacent(self) -> None:
        problem = _problem(
            Teacher(id="t1", name="T"), [_subject()], ["Monday"], slots=6,
            minimize_student_gaps=100,
        )
        result = _optimal(problem)
        slots = sorted(e.slot for e in result.schedule)
        assert slots[1] == slots[0] + 1

    def test_teacher_hours_are_adjacent(self) -> None:
        problem = _problem(
            Teacher(id="t1", name="T"), [_subject()], ["Monday"], slots=6,
            minimize_teacher_gaps=100,
        )
        result = _optimal(problem)
        slots = sorted(e.slot for e in result.schedule)
        assert slots[1] == slots[0] + 1


class TestSubjectSpread:
    def test_hours_spread_across_days(self) -> None:
        problem = _problem(
            Teacher(id="t1", name="T"), [_subject()], ["Mon", "Tue"], slots=2,
            spread_subjects=100,
        )
        result = _optimal(problem)
        assert len({e.day for e in result.schedule}) == 2


class TestCompactStyle:
    def test_compact_teacher_gets_adjacent_slots(self) -> None:
        teacher = Teacher(
            id="t1", name="T", preferences=TeacherPreferences(schedule_style="compact")
        )
        problem = _problem(
            teacher, [_subject()], ["Monday"], slots=6, compact_schedules=100
        )
        result = _optimal(problem)
        slots = sorted(e.slot for e in result.schedule)
        assert slots[1] == slots[0] + 1


class TestConsecutivePreference:
    def test_avoid_keeps_hours_apart(self) -> None:
        teacher = Teacher(
            id="t1", name="T", preferences=TeacherPreferences(consecutive_hours="avoid")
        )
        problem = _problem(
            teacher, [_subject()], ["Monday"], slots=4, avoid_consecutive_hours=100
        )
        result = _optimal(problem)
        slots = sorted(e.slot for e in result.schedule)
        assert slots[1] - slots[0] >= 2

    def test_prefer_packs_hours_together(self) -> None:
        teacher = Teacher(
            id="t1", name="T",
            preferences=TeacherPreferences(consecutive_hours="prefer", max_consecutive=3),
        )
        problem = _problem(
            teacher, [_subject()], ["Monday"], slots=4, avoid_consecutive_hours=100
        )
        result = _optimal(problem)
        slots = sorted(e.slot for e in result.schedule)
        assert slots[1] == slots[0] + 1


class TestLeaveEarly:
    def test_hours_placed_before_cutoff(self) -> None:
        teacher = Teacher(
            id="t1", name="T", preferences=TeacherPreferences(leave_early={"Monday": 2})
        )
        problem = _problem(teacher, [_subject()], ["Monday"], slots=4, leave_early=100)
        result = _optimal(problem)
        assert all(e.slot <= 2 for e in result.schedule)


class TestMaxHoursPerDay:
    def test_load_split_to_respect_daily_cap(self) -> None:
        teacher = Teacher(
            id="t1", name="T", preferences=TeacherPreferences(max_hours_per_day=1)
        )
        problem = _problem(
            teacher, [_subject()], ["Mon", "Tue"], slots=2, max_hours_per_day=100
        )
        result = _optimal(problem)
        assert len({e.day for e in result.schedule}) == 2


class TestFreeDays:
    def test_hours_compressed_to_leave_days_free(self) -> None:
        teacher = Teacher(
            id="t1", name="T", preferences=TeacherPreferences(min_free_days=2)
        )
        problem = _problem(
            teacher, [_subject(hours=3, max_per_day=3)], ["Mon", "Tue", "Wed"],
            slots=4, free_days=100,
        )
        result = _optimal(problem)
        assert len({e.day for e in result.schedule}) == 1


class TestWorkloadBalance:
    def test_daily_hours_balanced(self) -> None:
        problem = _problem(
            Teacher(id="t1", name="T"), [_subject()], ["Mon", "Tue"], slots=2,
            workload_balance=100,
        )
        result = _optimal(problem)
        assert len({e.day for e in result.schedule}) == 2


class TestQualityIntegration:
    def test_weighted_solve_scores_at_least_unweighted(self, fixtures_dir) -> None:
        problem = load_problem(fixtures_dir / "small_school.yaml")
        weighted = solve(problem, time_limit=30)

        bare = problem.model_copy(deep=True)
        bare.constraints.soft = SoftConstraints()
        unweighted = solve(bare, time_limit=30)

        assert weighted.quality_score is not None
        assert unweighted.quality_score is not None
        assert weighted.quality_score >= unweighted.quality_score

    def test_solve_populates_quality_score(self, fixtures_dir) -> None:
        problem = load_problem(fixtures_dir / "vtu_department.yaml")
        result = solve(problem, time_limit=60)
        assert result.quality_score is not None
        assert result.quality_score > 70
