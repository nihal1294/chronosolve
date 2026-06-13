"""Integration tests for the CP-SAT solver pipeline."""

from pathlib import Path

import pytest

from tests.verify import assert_hard_constraints
from timetable_solver import load_problem, solve
from timetable_solver.models import (
    PreAssignment,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)


class TestFixtureSolves:
    @pytest.mark.parametrize("name", ["minimal", "small_school", "vtu_department"])
    def test_fixture_solves_with_all_hard_constraints(self, fixtures_dir: Path, name: str) -> None:
        problem = load_problem(fixtures_dir / f"{name}.yaml")
        result = solve(problem, time_limit=30)
        assert result.status in ("optimal", "feasible")
        assert result.unresolved == []
        assert_hard_constraints(problem, result.schedule)

    def test_minimal_schedules_exact_hours(self, minimal_problem: TimetableProblem) -> None:
        result = solve(minimal_problem, time_limit=10)
        assert result.status == "optimal"
        assert len(result.schedule) == 3
        assert all(e.subject_id == "math101" for e in result.schedule)

    def test_progress_callback_fires(self, minimal_problem: TimetableProblem) -> None:
        events = []
        result = solve(minimal_problem, time_limit=10, on_progress=events.append)
        assert result.status == "optimal"
        assert len(events) >= 1
        assert events[-1].solution_count == len(events)

    def test_cancel_check_halts_search_early(self, fixtures_dir: Path) -> None:
        # A department-scale problem improves its objective over several
        # incumbents, so an always-true cancel_check must stop the search at
        # the first one (proving StopSearch is wired, not run-to-time-limit).
        problem = load_problem(fixtures_dir / "vtu_department.yaml")
        baseline: list[object] = []
        solve(problem, time_limit=10, on_progress=baseline.append)
        assert len(baseline) > 1, (
            "fixture must yield multiple incumbents for this test to be meaningful"
        )

        cancelled: list[object] = []
        result = solve(
            problem, time_limit=10, on_progress=cancelled.append, cancel_check=lambda: True
        )
        assert len(cancelled) == 1  # stopped right after the first incumbent
        assert result.schedule  # ...which is still a usable schedule


class TestPreAssignments:
    def test_pre_assigned_slot_respected(self, fixtures_dir: Path) -> None:
        problem = load_problem(fixtures_dir / "small_school.yaml")
        result = solve(problem, time_limit=30)
        fixed = [e for e in result.schedule if e.subject_id == "math_a"]
        assert any(e.day == "Monday" and e.slot == 1 for e in fixed)

    def test_pre_assigned_block_starts_at_slot(self, minimal_time_structure: TimeStructure) -> None:
        problem = TimetableProblem(
            time_structure=minimal_time_structure,
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
                )
            ],
            pre_assignments=[PreAssignment(subject_id="lab", day="Tuesday", slot=2)],
        )
        result = solve(problem, time_limit=10)
        assert result.status == "optimal"
        slots = sorted((e.day, e.slot) for e in result.schedule)
        assert slots == [("Tuesday", 2), ("Tuesday", 3)]


class TestRoomAssignment:
    def test_lab_subject_gets_lab_room(self, problem_with_rooms: TimetableProblem) -> None:
        result = solve(problem_with_rooms, time_limit=10)
        assert result.status == "optimal"
        lab_entries = [e for e in result.schedule if e.subject_id == "lab1"]
        assert lab_entries and all(e.room_id == "r2" for e in lab_entries)
        assert_hard_constraints(problem_with_rooms, result.schedule)

    def test_no_rooms_means_no_room_ids(self, minimal_problem: TimetableProblem) -> None:
        result = solve(minimal_problem, time_limit=10)
        assert all(e.room_id is None for e in result.schedule)


class TestInfeasibility:
    def test_more_hours_than_slots_is_infeasible(self) -> None:
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Monday"], slots_per_day=2),
            teachers=[Teacher(id="t1", name="T")],
            student_groups=[StudentGroup(id="g1", name="G", size=20)],
            subjects=[
                Subject(
                    id="s1",
                    name="S",
                    hours_per_week=3,
                    max_per_day=3,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                )
            ],
        )
        result = solve(problem, time_limit=10)
        assert result.status == "infeasible"
        assert result.schedule == []
        assert result.unresolved == ["s1"]

    def test_shared_teacher_overcommitted_is_infeasible(self) -> None:
        """Two groups need the same teacher for all slots of a 1-day week."""
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Monday"], slots_per_day=2),
            teachers=[Teacher(id="t1", name="T")],
            student_groups=[
                StudentGroup(id="g1", name="A", size=20),
                StudentGroup(id="g2", name="B", size=20),
            ],
            subjects=[
                Subject(
                    id="s1",
                    name="S1",
                    hours_per_week=2,
                    max_per_day=2,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                ),
                Subject(
                    id="s2",
                    name="S2",
                    hours_per_week=2,
                    max_per_day=2,
                    teacher_ids=["t1"],
                    group_ids=["g2"],
                ),
            ],
        )
        result = solve(problem, time_limit=10)
        assert result.status == "infeasible"


class TestAvailability:
    def test_blocked_day_stays_empty(self) -> None:
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Monday", "Tuesday"], slots_per_day=4),
            teachers=[Teacher(id="t1", name="T", unavailable={"Monday": [1, 2, 3, 4]})],
            student_groups=[StudentGroup(id="g1", name="G", size=20)],
            subjects=[
                Subject(
                    id="s1",
                    name="S",
                    hours_per_week=3,
                    max_per_day=3,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                ),
            ],
        )
        result = solve(problem, time_limit=10)
        assert result.status == "optimal"
        assert all(e.day == "Tuesday" for e in result.schedule)
