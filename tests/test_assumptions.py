"""Tests for the AssumptionRegistry (explainable hard-rule infeasibility)."""

from ortools.sat.python import cp_model

from timetable_solver.solver.assumptions import AssumptionRegistry


def test_registry_names_a_gated_infeasibility() -> None:
    model = cp_model.CpModel()
    x = model.new_bool_var("x")
    registry = AssumptionRegistry(model)
    lit = registry.gate("rule A: forces a contradiction")
    # With lit assumed true, x must be both 1 and 0 -> INFEASIBLE because of lit.
    model.add(x == 1).only_enforce_if(lit)
    model.add(x == 0).only_enforce_if(lit)

    solver = cp_model.CpSolver()
    status = solver.solve(model)

    assert status == cp_model.INFEASIBLE
    named = registry.describe(solver.sufficient_assumptions_for_infeasibility())
    assert named == ["rule A: forces a contradiction"]


def test_describe_ignores_unknown_indices() -> None:
    model = cp_model.CpModel()
    registry = AssumptionRegistry(model)
    assert registry.has_assumptions is False
    assert registry.describe([999]) == []


def test_gate_records_each_description() -> None:
    model = cp_model.CpModel()
    registry = AssumptionRegistry(model)
    registry.gate("first")
    registry.gate("second")
    assert registry.has_assumptions is True
