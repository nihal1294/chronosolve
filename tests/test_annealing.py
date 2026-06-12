"""Simulated annealing refinement tests."""

from pathlib import Path

from tests.verify import assert_hard_constraints
from timetable_solver import load_problem, score_schedule, solve
from timetable_solver.models import (
    ConstraintsConfig,
    PreAssignment,
    ScheduleEntry,
    SoftConstraints,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)
from timetable_solver.models.schedule import SolveResult
from timetable_solver.solver import anneal


def _entry(subject: str, day: str, slot: int) -> ScheduleEntry:
    return ScheduleEntry(
        subject_id=subject, day=day, slot=slot, teacher_ids=["t1"], group_ids=["g1"]
    )


def _gap_problem(**model_overrides) -> TimetableProblem:
    """One teacher, one group, two 1-hour subjects, gaps heavily penalized."""
    return TimetableProblem(
        time_structure=TimeStructure(days=["Monday"], slots_per_day=6),
        teachers=[Teacher(id="t1", name="T")],
        student_groups=[StudentGroup(id="g1", name="G", size=20)],
        subjects=[
            Subject(id="s1", name="S1", hours_per_week=1, teacher_ids=["t1"], group_ids=["g1"]),
            Subject(id="s2", name="S2", hours_per_week=1, teacher_ids=["t1"], group_ids=["g1"]),
        ],
        constraints=ConstraintsConfig(soft=SoftConstraints(minimize_student_gaps=100)),
        **model_overrides,
    )


class TestAnneal:
    def test_improves_a_gappy_schedule(self) -> None:
        problem = _gap_problem()
        gappy = SolveResult(
            status="feasible",
            schedule=[_entry("s1", "Monday", 1), _entry("s2", "Monday", 6)],
        )
        initial = score_schedule(problem, gappy.schedule).overall_score
        refined = anneal(problem, gappy, seed=42)
        final = score_schedule(problem, refined.schedule).overall_score
        assert final > initial
        assert final == 100.0  # adjacent slots are reachable in this tiny space
        assert_hard_constraints(problem, refined.schedule)

    def test_never_returns_worse_or_invalid(self) -> None:
        problem = _gap_problem()
        start = SolveResult(
            status="optimal",
            schedule=[_entry("s1", "Monday", 2), _entry("s2", "Monday", 3)],
        )
        refined = anneal(problem, start, seed=7)
        assert score_schedule(problem, refined.schedule).overall_score >= 100.0
        assert_hard_constraints(problem, refined.schedule)

    def test_pre_assigned_entries_stay_pinned(self) -> None:
        problem = _gap_problem(
            pre_assignments=[PreAssignment(subject_id="s1", day="Monday", slot=1)]
        )
        start = SolveResult(
            status="feasible",
            schedule=[_entry("s1", "Monday", 1), _entry("s2", "Monday", 5)],
        )
        refined = anneal(problem, start, seed=3)
        pinned = [e for e in refined.schedule if e.subject_id == "s1"]
        assert pinned == [_entry("s1", "Monday", 1)]

    def test_block_subjects_are_never_moved(self) -> None:
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Monday"], slots_per_day=6),
            teachers=[Teacher(id="t1", name="T")],
            student_groups=[StudentGroup(id="g1", name="G", size=20)],
            subjects=[
                Subject(
                    id="lab",
                    name="Lab",
                    hours_per_week=2,
                    type="lab",
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                    consecutive_hours=2,
                ),
                Subject(id="s1", name="S1", hours_per_week=1, teacher_ids=["t1"], group_ids=["g1"]),
            ],
            constraints=ConstraintsConfig(soft=SoftConstraints(minimize_student_gaps=100)),
        )
        start = SolveResult(
            status="feasible",
            schedule=[
                _entry("lab", "Monday", 1),
                _entry("lab", "Monday", 2),
                _entry("s1", "Monday", 6),
            ],
        )
        refined = anneal(problem, start, seed=11)
        lab_slots = sorted(e.slot for e in refined.schedule if e.subject_id == "lab")
        assert lab_slots == [1, 2]
        assert_hard_constraints(problem, refined.schedule)

    def test_empty_schedule_passthrough(self) -> None:
        problem = _gap_problem()
        result = SolveResult(status="infeasible")
        assert anneal(problem, result, seed=1) is result


class TestSolveWithRefine:
    def test_refined_solve_is_valid_and_no_worse(self, fixtures_dir: Path) -> None:
        problem = load_problem(fixtures_dir / "small_school.yaml")
        plain = solve(problem, time_limit=30)
        refined = solve(problem, time_limit=30, refine=True)
        assert refined.quality_score is not None
        assert plain.quality_score is not None
        assert refined.quality_score >= plain.quality_score
        assert_hard_constraints(problem, refined.schedule)
