"""Tests for the AssumptionRegistry (explainable hard-rule infeasibility)."""

from ortools.sat.python import cp_model

from timetable_solver.models.rules import RuleRef
from timetable_solver.models.schedule import RuleConflict
from timetable_solver.solver.assumptions import AssumptionRegistry


def test_registry_names_a_gated_infeasibility() -> None:
    model = cp_model.CpModel()
    x = model.new_bool_var("x")
    registry = AssumptionRegistry(model)
    lit = registry.gate(RuleRef(kind="ordering", key="0"), "rule A: forces a contradiction")
    # With lit assumed true, x must be both 1 and 0 -> INFEASIBLE because of lit.
    model.add(x == 1).only_enforce_if(lit)
    model.add(x == 0).only_enforce_if(lit)

    solver = cp_model.CpSolver()
    status = solver.solve(model)

    assert status == cp_model.INFEASIBLE
    named = registry.describe(solver.sufficient_assumptions_for_infeasibility())
    assert named == [
        RuleConflict(
            ref=RuleRef(kind="ordering", key="0"),
            description="rule A: forces a contradiction",
        )
    ]


def test_describe_ignores_unknown_indices() -> None:
    model = cp_model.CpModel()
    registry = AssumptionRegistry(model)
    assert registry.has_assumptions is False
    assert registry.describe([999]) == []


def test_gate_records_each_description() -> None:
    model = cp_model.CpModel()
    registry = AssumptionRegistry(model)
    registry.gate(RuleRef(kind="global_break", key="0"), "first")
    registry.gate(RuleRef(kind="global_break", key="1"), "second")
    assert registry.has_assumptions is True


def test_describe_returns_deduped_conflicts() -> None:
    registry = AssumptionRegistry(cp_model.CpModel())
    lit_a = registry.gate(RuleRef(kind="ordering", key="0"), "A before B")
    lit_b = registry.gate(RuleRef(kind="same_day", key="1"), "C and D not same day")
    out = registry.describe([lit_a.index, lit_b.index, lit_a.index])  # duplicate index
    assert out == [
        RuleConflict(ref=RuleRef(kind="ordering", key="0"), description="A before B"),
        RuleConflict(ref=RuleRef(kind="same_day", key="1"), description="C and D not same day"),
    ]
