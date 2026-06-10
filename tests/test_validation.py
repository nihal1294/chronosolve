"""Tests for pre-solve validation — feasibility errors and warnings."""

from pathlib import Path

from timetable_solver.io.loader import load_yaml
from timetable_solver.models import (
    PreAssignment,
    Room,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)
from timetable_solver.validation.validator import Severity, validate_problem

FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestCleanValidation:
    def test_minimal_is_clean(self) -> None:
        problem = load_yaml(FIXTURES_DIR / "minimal.yaml")
        issues = validate_problem(problem)
        assert issues == []

    def test_small_school_is_clean(self) -> None:
        problem = load_yaml(FIXTURES_DIR / "small_school.yaml")
        issues = validate_problem(problem)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert errors == []

    def test_vtu_department_is_clean(self) -> None:
        problem = load_yaml(FIXTURES_DIR / "vtu_department.yaml")
        issues = validate_problem(problem)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert errors == []


class TestGroupHoursFeasibility:
    def test_group_needs_more_hours_than_available(self) -> None:
        """Group has 3 days × 2 slots = 6 available, but needs 7 hours."""
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Mon", "Tue", "Wed"], slots_per_day=2),
            teachers=[Teacher(id="t1", name="T1")],
            student_groups=[StudentGroup(id="g1", name="G1", size=30)],
            subjects=[
                Subject(
                    id="s1",
                    name="Heavy Subject",
                    hours_per_week=7,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                )
            ],
        )
        issues = validate_problem(problem)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        # Both group and teacher get flagged (teacher also needs 7h in 6 slots)
        assert len(errors) >= 1
        group_errors = [e for e in errors if "g1" in e.message]
        assert len(group_errors) == 1
        assert "7 hours" in group_errors[0].message

    def test_group_near_capacity_warns(self) -> None:
        """Group uses >90% of slots — should warn."""
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Mon", "Tue", "Wed"], slots_per_day=4),
            teachers=[Teacher(id="t1", name="T1")],
            student_groups=[StudentGroup(id="g1", name="G1", size=30)],
            subjects=[
                Subject(
                    id="s1",
                    name="Heavy",
                    hours_per_week=11,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                )
            ],
        )
        issues = validate_problem(problem)
        warnings = [i for i in issues if i.severity == Severity.WARNING]
        assert len(warnings) >= 1
        assert "solver may struggle" in warnings[0].message


class TestTeacherFeasibility:
    def test_teacher_needs_more_than_available(self) -> None:
        """Teacher is unavailable most slots, can't fit required hours."""
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Mon", "Tue"], slots_per_day=3),
            teachers=[
                Teacher(
                    id="t1",
                    name="Busy Teacher",
                    unavailable={"Mon": [1, 2, 3], "Tue": [1, 2]},
                )
            ],
            student_groups=[StudentGroup(id="g1", name="G1", size=30)],
            subjects=[
                Subject(
                    id="s1",
                    name="Sub",
                    hours_per_week=2,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                )
            ],
        )
        issues = validate_problem(problem)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert len(errors) == 1
        assert "t1" in errors[0].message


class TestPreAssignmentClashes:
    def test_same_teacher_clashing_pre_assignments(self) -> None:
        """Two subjects with same teacher pre-assigned to same slot."""
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Mon"], slots_per_day=4),
            teachers=[Teacher(id="t1", name="T1")],
            student_groups=[
                StudentGroup(id="g1", name="G1", size=30),
                StudentGroup(id="g2", name="G2", size=30),
            ],
            subjects=[
                Subject(
                    id="s1", name="S1", hours_per_week=1,
                    teacher_ids=["t1"], group_ids=["g1"],
                ),
                Subject(
                    id="s2", name="S2", hours_per_week=1,
                    teacher_ids=["t1"], group_ids=["g2"],
                ),
            ],
            pre_assignments=[
                PreAssignment(subject_id="s1", day="Mon", slot=1),
                PreAssignment(subject_id="s2", day="Mon", slot=1),
            ],
        )
        issues = validate_problem(problem)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert any("t1" in e.message and "clashing" in e.message for e in errors)


class TestRoomCapacityWarnings:
    def test_group_exceeds_room_capacity(self) -> None:
        """Subject with 100 students but largest room holds 50."""
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Mon"], slots_per_day=4),
            teachers=[Teacher(id="t1", name="T1")],
            student_groups=[StudentGroup(id="g1", name="G1", size=100)],
            subjects=[
                Subject(
                    id="s1", name="S1", hours_per_week=2,
                    teacher_ids=["t1"], group_ids=["g1"],
                    preferred_room_type="lecture",
                )
            ],
            rooms=[Room(id="r1", name="Room", capacity=50, type="lecture")],
        )
        issues = validate_problem(problem)
        warnings = [i for i in issues if i.severity == Severity.WARNING]
        assert len(warnings) >= 1
        assert "100 students" in warnings[0].message
