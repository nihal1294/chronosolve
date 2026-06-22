"""Tests for pre-solve validation - feasibility errors and warnings."""

from pathlib import Path

from timetable_solver.io.loader import load_yaml
from timetable_solver.models import (
    AdvancedConstraints,
    ConstraintsConfig,
    GlobalBreak,
    GroupFreeHalfDay,
    HardConstraints,
    PreAssignment,
    Room,
    RoomReservation,
    StudentGroup,
    Subject,
    SubjectPair,
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

    def test_group_daily_cap_limits_available_hours(self) -> None:
        """Cap of 1h/day across 3 days leaves 3 usable slots; 4 hours must error."""
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Mon", "Tue", "Wed"], slots_per_day=4),
            teachers=[Teacher(id="t1", name="T1")],
            student_groups=[StudentGroup(id="g1", name="G1", size=30, max_hours_per_day=1)],
            subjects=[
                Subject(
                    id="s1",
                    name="Subject",
                    hours_per_week=4,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                )
            ],
        )
        issues = validate_problem(problem)
        group_errors = [i for i in issues if i.severity == Severity.ERROR and "g1" in i.message]
        assert len(group_errors) == 1
        assert "only has 3" in group_errors[0].message

    def test_group_near_capacity_warns(self) -> None:
        """Group uses >90% of slots - should warn."""
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
                    id="s1",
                    name="S1",
                    hours_per_week=1,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                ),
                Subject(
                    id="s2",
                    name="S2",
                    hours_per_week=1,
                    teacher_ids=["t1"],
                    group_ids=["g2"],
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
                    id="s1",
                    name="S1",
                    hours_per_week=2,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                    preferred_room_type="lecture",
                )
            ],
            rooms=[Room(id="r1", name="Room", capacity=50, type="lecture")],
        )
        issues = validate_problem(problem)
        warnings = [i for i in issues if i.severity == Severity.WARNING]
        assert len(warnings) >= 1
        assert "100 students" in warnings[0].message


class TestAdvancedRuleChecks:
    def _base(self, *, subjects, rooms=None, hard=None, advanced=None, slots=4):
        return TimetableProblem(
            time_structure=TimeStructure(days=["Mon", "Tue", "Wed"], slots_per_day=slots),
            teachers=[Teacher(id="t1", name="T1")],
            student_groups=[StudentGroup(id="g1", name="G1", size=20)],
            subjects=subjects,
            rooms=rooms or [],
            constraints=ConstraintsConfig(
                hard=HardConstraints(**(hard or {})),
                advanced=AdvancedConstraints(**(advanced or {})),
            ),
        )

    def test_required_tags_with_no_matching_room_errors(self) -> None:
        problem = self._base(
            subjects=[
                Subject(
                    id="ml",
                    name="ML",
                    hours_per_week=2,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                    required_tags={"gpu"},
                )
            ],
            rooms=[Room(id="r1", name="R1", capacity=40)],  # no gpu tag
        )
        issues = validate_problem(problem)
        assert any(i.severity == Severity.ERROR and "gpu" in i.message for i in issues)

    def test_capacity_warning_respects_required_tags(self) -> None:
        # A big room without the tag must NOT be the capacity baseline; only the
        # small tagged room is eligible, so the 20-student group overflows it.
        problem = self._base(
            subjects=[
                Subject(
                    id="ml",
                    name="ML",
                    hours_per_week=2,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                    required_tags={"gpu"},
                )
            ],
            rooms=[
                Room(id="big", name="Big", capacity=100),  # no gpu tag
                Room(id="gpu", name="GPU", capacity=10, tags={"gpu"}),  # tagged but small
            ],
        )
        warnings = [i for i in validate_problem(problem) if i.severity == Severity.WARNING]
        assert any("ml" in w.message for w in warnings)

    def test_required_tags_satisfied_is_clean(self) -> None:
        problem = self._base(
            subjects=[
                Subject(
                    id="ml",
                    name="ML",
                    hours_per_week=2,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                    required_tags={"gpu"},
                )
            ],
            rooms=[Room(id="r1", name="R1", capacity=40, tags={"gpu"})],
        )
        errors = [i for i in validate_problem(problem) if i.severity == Severity.ERROR]
        assert errors == []

    def test_capacity_flag_with_no_room_large_enough_errors(self) -> None:
        problem = self._base(
            subjects=[
                Subject(
                    id="big", name="Big", hours_per_week=2, teacher_ids=["t1"], group_ids=["g1"]
                )
            ],
            rooms=[Room(id="r1", name="R1", capacity=10)],  # group is 20
            hard={"room_capacity": True},
        )
        assert any(i.severity == Severity.ERROR for i in validate_problem(problem))

    def test_capacity_flag_off_does_not_error_on_small_room(self) -> None:
        problem = self._base(
            subjects=[
                Subject(
                    id="big", name="Big", hours_per_week=2, teacher_ids=["t1"], group_ids=["g1"]
                )
            ],
            rooms=[Room(id="r1", name="R1", capacity=10)],
        )
        errors = [i for i in validate_problem(problem) if i.severity == Severity.ERROR]
        assert errors == []

    def test_global_breaks_leaving_too_few_slots_errors(self) -> None:
        # 3 days x 2 slots = 6 total; the subject needs 6 hours; a break removes 1 -> 5 < 6.
        problem = self._base(
            subjects=[
                Subject(
                    id="s",
                    name="S",
                    hours_per_week=6,
                    max_per_day=2,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                )
            ],
            slots=2,
            advanced={"global_breaks": [GlobalBreak(day="Mon", slots=[1])]},
        )
        issues = validate_problem(problem)
        assert any(i.severity == Severity.ERROR and "break" in i.message.lower() for i in issues)


class TestAdvancedReferenceChecks:
    def _problem(self, *, advanced, rooms=None):
        return TimetableProblem(
            time_structure=TimeStructure(days=["Mon", "Tue", "Wed"], slots_per_day=4),
            teachers=[Teacher(id="t1", name="T1")],
            student_groups=[StudentGroup(id="g1", name="G1", size=20)],
            subjects=[
                Subject(id="a", name="A", hours_per_week=1, teacher_ids=["t1"], group_ids=["g1"]),
                Subject(id="b", name="B", hours_per_week=1, teacher_ids=["t1"], group_ids=["g1"]),
            ],
            rooms=rooms or [],
            constraints=ConstraintsConfig(advanced=AdvancedConstraints(**advanced)),
        )

    def _errors(self, problem):
        return [i for i in validate_problem(problem) if i.severity == Severity.ERROR]

    def test_valid_references_are_clean(self) -> None:
        problem = self._problem(
            advanced={
                "global_breaks": [GlobalBreak(day="Mon", slots=[1])],
                "orderings": [SubjectPair(first="a", second="b")],
                "hard_teacher_daily_caps": {"t1": 2},
                "group_free_halfdays": [GroupFreeHalfDay(group_id="g1", day="Tue", half="morning")],
            },
        )
        assert self._errors(problem) == []

    def test_unknown_day_in_break_errors(self) -> None:
        problem = self._problem(advanced={"global_breaks": [GlobalBreak(day="Friday", slots=[1])]})
        assert any("Friday" in e.message for e in self._errors(problem))

    def test_unknown_subject_in_ordering_errors(self) -> None:
        problem = self._problem(advanced={"orderings": [SubjectPair(first="a", second="ghost")]})
        assert any("ghost" in e.message for e in self._errors(problem))

    def test_unknown_teacher_in_cap_errors(self) -> None:
        problem = self._problem(advanced={"hard_teacher_daily_caps": {"ghost": 2}})
        assert any("ghost" in e.message for e in self._errors(problem))

    def test_unknown_group_in_halfday_errors(self) -> None:
        problem = self._problem(
            advanced={
                "group_free_halfdays": [
                    GroupFreeHalfDay(group_id="ghost", day="Mon", half="morning")
                ]
            },
        )
        assert any("ghost" in e.message for e in self._errors(problem))

    def test_unknown_room_in_reservation_errors(self) -> None:
        problem = self._problem(
            advanced={"room_reservations": [RoomReservation(room_id="ghost", subject_ids=["a"])]},
            rooms=[Room(id="r1", name="R1", capacity=40)],
        )
        assert any("ghost" in e.message for e in self._errors(problem))
