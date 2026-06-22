"""Hard rule generators for M7 advanced constraints (rules 2, 3, 5-H, 22, 23).

Each builder has signature (model, variables, problem, registry). It is gated on
its slice of constraints.advanced being non-empty (so a default problem adds
nothing) and gates every constraint instance on a registry assumption literal, so
an infeasibility can be traced back to the offending rule. Builders are collected
in RULE_HARD_BUILDERS and run by cpsat_solver.solve.
"""

from collections.abc import Callable

from ortools.sat.python import cp_model

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.solver.assumptions import AssumptionRegistry
from timetable_solver.solver.variables import SolverVariables

RuleHardBuilder = Callable[
    [cp_model.CpModel, SolverVariables, TimetableProblem, AssumptionRegistry], None
]


def add_global_breaks(
    model: cp_model.CpModel,
    variables: SolverVariables,
    problem: TimetableProblem,
    registry: AssumptionRegistry,
) -> None:
    """Rule 2: no subject may occupy a slot inside a declared global break."""
    breaks = problem.constraints.advanced.global_breaks
    if not breaks:
        return
    day_index = {day: i for i, day in enumerate(problem.time_structure.days)}
    for brk in breaks:
        day_idx = day_index.get(brk.day)
        if day_idx is None:
            continue
        for slot in brk.slots:
            lit = registry.gate(f"break on {brk.day} slot {slot}")
            for subject in problem.subjects:
                var = variables.assignments.get((subject.id, day_idx, slot))
                if var is not None:
                    model.add(var == 0).only_enforce_if(lit)


def add_allowed_slots(
    model: cp_model.CpModel,
    variables: SolverVariables,
    problem: TimetableProblem,
    registry: AssumptionRegistry,
) -> None:
    """Rule 3: a subject with allowed_slots may only occupy those slot numbers."""
    for subject in problem.subjects:
        if subject.allowed_slots is None:
            continue
        allowed = set(subject.allowed_slots)
        lit = registry.gate(f"{subject.id} limited to slots {sorted(allowed)}")
        for (sid, _day_idx, slot), var in variables.assignments.items():
            if sid == subject.id and slot not in allowed:
                model.add(var == 0).only_enforce_if(lit)


def add_hard_teacher_caps(
    model: cp_model.CpModel,
    variables: SolverVariables,
    problem: TimetableProblem,
    registry: AssumptionRegistry,
) -> None:
    """Rule 5-H: cap a teacher's total hours on any single day (hard form)."""
    caps = problem.constraints.advanced.hard_teacher_daily_caps
    if not caps:
        return
    for teacher_id, cap in caps.items():
        subject_ids = [s.id for s in problem.subjects if teacher_id in s.teacher_ids]
        if not subject_ids:
            continue
        lit = registry.gate(f"teacher {teacher_id} max {cap}h/day")
        for day_idx, day in enumerate(problem.time_structure.days):
            slots = problem.time_structure.get_slots_for_day(day)
            day_vars = [
                variables.assignments[(sid, day_idx, slot)]
                for sid in subject_ids
                for slot in range(1, slots + 1)
            ]
            if len(day_vars) > cap:
                model.add(sum(day_vars) <= cap).only_enforce_if(lit)


def _present_on_day(
    model: cp_model.CpModel,
    variables: SolverVariables,
    subject_id: str,
    day_idx: int,
) -> cp_model.IntVar | None:
    """A boolean that is true iff the subject occupies any slot on the day (an OR)."""
    day_vars = [
        var
        for (sid, d, _), var in variables.assignments.items()
        if sid == subject_id and d == day_idx
    ]
    if not day_vars:
        return None
    present = model.new_bool_var(f"present_{subject_id}_{day_idx}")
    model.add_max_equality(present, day_vars)
    return present


def add_same_day_exclusions(
    model: cp_model.CpModel,
    variables: SolverVariables,
    problem: TimetableProblem,
    registry: AssumptionRegistry,
) -> None:
    """Rule 22: a pair of subjects may not both appear on the same day."""
    pairs = problem.constraints.advanced.same_day_exclusions
    if not pairs:
        return
    for pair in pairs:
        lit = registry.gate(f"{pair.first} and {pair.second} not on the same day")
        for day_idx in range(len(problem.time_structure.days)):
            a = _present_on_day(model, variables, pair.first, day_idx)
            b = _present_on_day(model, variables, pair.second, day_idx)
            if a is None or b is None:
                continue
            model.add(a + b <= 1).only_enforce_if(lit)


def _first_index(
    model: cp_model.CpModel,
    variables: SolverVariables,
    subject_id: str,
    max_slots: int,
    big: int,
) -> cp_model.IntVar | None:
    """An int var = earliest global (day*max_slots + slot) the subject occupies, else big.

    Each candidate slot contributes `big - (big - g) * occ`, which is its global
    index g when occupied and the sentinel `big` when not; the min over those is
    the subject's first occupied position (big if it is never scheduled).
    """
    terms = [
        big - (big - (day_idx * max_slots + slot)) * var
        for (sid, day_idx, slot), var in variables.assignments.items()
        if sid == subject_id
    ]
    if not terms:
        return None
    idx = model.new_int_var(0, big, f"first_{subject_id}")
    model.add_min_equality(idx, terms)
    return idx


def add_orderings(
    model: cp_model.CpModel,
    variables: SolverVariables,
    problem: TimetableProblem,
    registry: AssumptionRegistry,
) -> None:
    """Rule 23: subject `first` must start before subject `second` each week."""
    pairs = problem.constraints.advanced.orderings
    if not pairs:
        return
    days = problem.time_structure.days
    max_slots = max(problem.time_structure.get_slots_for_day(d) for d in days)
    big = len(days) * max_slots + 1
    for pair in pairs:
        first = _first_index(model, variables, pair.first, max_slots, big)
        second = _first_index(model, variables, pair.second, max_slots, big)
        if first is None or second is None:
            continue
        lit = registry.gate(f"{pair.first} must run before {pair.second}")
        model.add(first < second).only_enforce_if(lit)


RULE_HARD_BUILDERS: tuple[RuleHardBuilder, ...] = (
    add_global_breaks,
    add_allowed_slots,
    add_hard_teacher_caps,
    add_same_day_exclusions,
    add_orderings,
)
