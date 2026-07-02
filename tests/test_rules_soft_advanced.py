"""M7.3 soft counterparts of the 5 gated hard rules.

A softened rule with weight > 0 is a preference: the schedule is allowed and the
violation minimized, not forbidden. Each builder must emit penalty terms only for
softened instances of its kind, gated on its weight. Control: revert a builder
body and its gating/feasibility assertion fails.
"""

from ortools.sat.python import cp_model

from tests.test_rules_hard import _advanced_problem, _subject
from timetable_solver import solve
from timetable_solver.models import GlobalBreak, SubjectPair
from timetable_solver.models.rules import RuleRef
from timetable_solver.solver.rules_soft_advanced import (
    add_soft_allowed_slots_penalty,
    add_soft_break_penalty,
    add_soft_ordering_penalty,
    add_soft_same_day_penalty,
    add_soft_teacher_cap_penalty,
)
from timetable_solver.solver.variables import create_variables


def _break(*, softened: bool, weight: int):
    problem = _advanced_problem(
        subjects=[_subject("math", hours=4, max_per_day=4)],
        days=["Monday"],
        slots=4,
        advanced={
            "global_breaks": [GlobalBreak(day="Monday", slots=[1, 2])],
            "softened": [RuleRef(kind="break", key="0")] if softened else [],
        },
    )
    problem.constraints.soft.soft_break = weight
    return problem


def _allowed(*, softened: bool, weight: int):
    problem = _advanced_problem(
        subjects=[_subject("math", hours=2, max_per_day=2, allowed_slots=[1])],
        days=["Monday"],
        slots=2,
        advanced={"softened": [RuleRef(kind="allowed_slots", key="math")] if softened else []},
    )
    problem.constraints.soft.soft_allowed_slots = weight
    return problem


def _cap(*, softened: bool, weight: int):
    problem = _advanced_problem(
        subjects=[_subject("math", hours=2, max_per_day=2)],
        days=["Monday"],
        slots=2,
        advanced={
            "hard_teacher_daily_caps": {"t1": 1},
            "softened": [RuleRef(kind="teacher_cap", key="t1")] if softened else [],
        },
    )
    problem.constraints.soft.soft_teacher_cap = weight
    return problem


def _same_day(*, softened: bool, weight: int):
    problem = _advanced_problem(
        subjects=[_subject("a", hours=1), _subject("b", hours=1)],
        days=["Monday"],
        slots=2,
        advanced={
            "same_day_exclusions": [SubjectPair(first="a", second="b")],
            "softened": [RuleRef(kind="same_day", key="0")] if softened else [],
        },
    )
    problem.constraints.soft.soft_same_day = weight
    return problem


def _ordering(*, softened: bool, weight: int):
    # a is pinned to slot 2 and b to slot 1 (hard allowed_slots stay enforced),
    # so the ordering "a before b" is satisfiable only once softened.
    problem = _advanced_problem(
        subjects=[
            _subject("a", hours=1, allowed_slots=[2]),
            _subject("b", hours=1, allowed_slots=[1]),
        ],
        days=["Monday"],
        slots=2,
        advanced={
            "orderings": [SubjectPair(first="a", second="b")],
            "softened": [RuleRef(kind="ordering", key="0")] if softened else [],
        },
    )
    problem.constraints.soft.soft_ordering = weight
    return problem


def _terms(builder, problem):
    model = cp_model.CpModel()
    variables = create_variables(model, problem)
    return builder(model, variables, problem)


def _assert_gated(builder, factory) -> None:
    assert _terms(builder, factory(softened=True, weight=50)) != []
    assert _terms(builder, factory(softened=True, weight=0)) == []
    assert _terms(builder, factory(softened=False, weight=50)) == []


def test_soft_break_gated() -> None:
    _assert_gated(add_soft_break_penalty, _break)


def test_soft_allowed_slots_gated() -> None:
    _assert_gated(add_soft_allowed_slots_penalty, _allowed)


def test_soft_teacher_cap_gated() -> None:
    _assert_gated(add_soft_teacher_cap_penalty, _cap)


def test_soft_same_day_gated() -> None:
    _assert_gated(add_soft_same_day_penalty, _same_day)


def test_soft_ordering_gated() -> None:
    _assert_gated(add_soft_ordering_penalty, _ordering)


def test_softened_break_is_feasible_when_weighted() -> None:
    assert solve(_break(softened=True, weight=50), time_limit=10).status in ("optimal", "feasible")


def test_softened_cap_is_feasible_when_weighted() -> None:
    assert solve(_cap(softened=True, weight=50), time_limit=10).status in ("optimal", "feasible")


def test_softened_same_day_is_feasible_when_weighted() -> None:
    assert solve(_same_day(softened=True, weight=50), time_limit=10).status in (
        "optimal",
        "feasible",
    )


def test_softened_allowed_slots_is_feasible_when_weighted() -> None:
    assert solve(_allowed(softened=True, weight=50), time_limit=10).status in (
        "optimal",
        "feasible",
    )


def test_softened_ordering_is_feasible_when_weighted() -> None:
    assert solve(_ordering(softened=True, weight=50), time_limit=10).status in (
        "optimal",
        "feasible",
    )
