"""Tests for M7 soft rule generators (rules 15, 26, 27, 28).

Each builds a problem where the preferred shape is the proven optimum, so the
assertion is deterministic; reverting the generator removes the term and the
optimum is no longer forced into the preferred shape.
"""

from timetable_solver import solve
from timetable_solver.models import (
    AdvancedConstraints,
    ConstraintsConfig,
    GroupFreeHalfDay,
    PreAssignment,
    Room,
    SoftConstraints,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)


def _same_room_problem(*, same_room: int) -> TimetableProblem:
    """Two slots, two rooms; a blocker pins room r1 at slot 1 so 'math' is forced
    onto r2 there. Without the same-room penalty the solver may take r1 at slot 2
    (two rooms); with it, math keeps r2 for both sessions.
    """
    rooms = [
        Room(id="r1", name="R1", capacity=40, type="lab"),
        Room(id="r2", name="R2", capacity=40),
    ]
    math = Subject(
        id="math",
        name="Math",
        hours_per_week=2,
        max_per_day=2,
        teacher_ids=["t1"],
        group_ids=["g1"],
    )
    blocker = Subject(
        id="block",
        name="Block",
        hours_per_week=1,
        teacher_ids=["t2"],
        group_ids=["g2"],
        preferred_room_type="lab",
    )
    return TimetableProblem(
        time_structure=TimeStructure(days=["Monday"], slots_per_day=2),
        teachers=[Teacher(id="t1", name="T1"), Teacher(id="t2", name="T2")],
        student_groups=[
            StudentGroup(id="g1", name="G1", size=30),
            StudentGroup(id="g2", name="G2", size=20),
        ],
        subjects=[math, blocker],
        rooms=rooms,
        pre_assignments=[PreAssignment(subject_id="block", day="Monday", slot=1)],
        constraints=ConstraintsConfig(
            soft=SoftConstraints(same_room=same_room),
            advanced=AdvancedConstraints(same_room_subjects=["math"]),
        ),
    )


def _problem(
    *,
    subjects: list[Subject],
    days: list[str],
    slots: int,
    groups: list[StudentGroup] | None = None,
    teachers: list[Teacher] | None = None,
    rooms: list[Room] | None = None,
    advanced: dict | None = None,
    **soft: int,
) -> TimetableProblem:
    return TimetableProblem(
        time_structure=TimeStructure(days=days, slots_per_day=slots),
        teachers=teachers or [Teacher(id="t1", name="T")],
        student_groups=groups or [StudentGroup(id="g1", name="G", size=20)],
        subjects=subjects,
        rooms=rooms or [],
        constraints=ConstraintsConfig(
            soft=SoftConstraints(**soft),
            advanced=AdvancedConstraints(**(advanced or {})),
        ),
    )


def _subject(sid: str, hours: int = 2, **extra: object) -> Subject:
    return Subject(
        id=sid,
        name=sid.upper(),
        hours_per_week=hours,
        teacher_ids=["t1"],
        group_ids=["g1"],
        **extra,
    )


class TestGroupWorkloadBalance:
    def test_high_weight_spreads_group_hours_across_days(self) -> None:
        # 4 hours over two days; balancing to 2 + 2 is the unique minimum-deviation optimum.
        problem = _problem(
            subjects=[_subject("math", hours=4, max_per_day=4)],
            days=["Monday", "Tuesday"],
            slots=4,
            group_workload_balance=80,
        )
        result = solve(problem, time_limit=15)
        assert result.status == "optimal"
        per_day = {"Monday": 0, "Tuesday": 0}
        for entry in result.schedule:
            per_day[entry.day] += 1
        assert max(per_day.values()) - min(per_day.values()) <= 1


class TestBackToBackLabs:
    def test_high_weight_separates_group_labs(self) -> None:
        # Two 1-hour labs for one group on a 4-slot day; the penalty pushes them
        # out of adjacent slots, which is achievable at zero cost.
        labs = [_subject("la", hours=1, type="lab"), _subject("lb", hours=1, type="lab")]
        problem = _problem(subjects=labs, days=["Monday"], slots=4, avoid_consecutive_labs=90)
        result = solve(problem, time_limit=15)
        assert result.status == "optimal"
        slots = sorted(e.slot for e in result.schedule)
        assert len(slots) == 2
        assert slots[1] - slots[0] >= 2


class TestGroupFreeHalfDay:
    def test_high_weight_clears_the_requested_half(self) -> None:
        # 2 hours, afternoon (slots 3-4) requested free; the morning absorbs them.
        problem = _problem(
            subjects=[_subject("math", hours=2, max_per_day=2)],
            days=["Monday"],
            slots=4,
            advanced={
                "group_free_halfdays": [
                    GroupFreeHalfDay(group_id="g1", day="Monday", half="afternoon")
                ]
            },
            group_free_halfday=80,
        )
        result = solve(problem, time_limit=15)
        assert result.status == "optimal"
        assert result.schedule
        assert all(e.slot in (1, 2) for e in result.schedule)


class TestSameRoom:
    def test_high_weight_collapses_subject_onto_one_room(self) -> None:
        # Deterministic-at-optimum: with the penalty active, both math sessions
        # share a room (the solver also does this by default, so this guards the
        # behaviour but not regressions - the unit tests below are the control).
        result = solve(_same_room_problem(same_room=80), time_limit=15)
        assert result.status == "optimal"
        rooms_used = {e.room_id for e in result.schedule if e.subject_id == "math"}
        assert len(rooms_used) == 1

    def test_penalty_term_built_for_multiroom_subject(self) -> None:
        # Strict control: math can use either room, so the generator must emit a
        # penalty term. Reverting add_same_room_penalty to `return []` fails this.
        from ortools.sat.python import cp_model

        from timetable_solver.solver.rules_soft import add_same_room_penalty
        from timetable_solver.solver.variables import create_variables

        problem = _same_room_problem(same_room=50)
        model = cp_model.CpModel()
        variables = create_variables(model, problem)
        assert add_same_room_penalty(model, variables, problem)

    def test_no_penalty_term_when_weight_zero(self) -> None:
        from ortools.sat.python import cp_model

        from timetable_solver.solver.rules_soft import add_same_room_penalty
        from timetable_solver.solver.variables import create_variables

        problem = _same_room_problem(same_room=0)
        model = cp_model.CpModel()
        variables = create_variables(model, problem)
        assert add_same_room_penalty(model, variables, problem) == []
