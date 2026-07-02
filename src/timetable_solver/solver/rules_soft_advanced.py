"""Soft penalty forms of the 5 assumption-gated advanced hard rules (M7.3).

Each mirrors its rules_hard counterpart but as a weighted penalty applied ONLY to
instances the user has softened (advanced.softened) and gated on the matching
SoftConstraints weight. Folded into soft.add_soft_objectives. Because these are
objective terms (never constraints), a softened rule can never cause infeasibility.
"""

from ortools.sat.python import cp_model

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.rules import is_softened
from timetable_solver.solver.rule_helpers import first_index, present_on_day
from timetable_solver.solver.soft_helpers import positive_part
from timetable_solver.solver.variables import SolverVariables

Terms = list[cp_model.LinearExpr]


def add_soft_break_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Penalize any class scheduled inside a softened global break (rule 2, soft)."""
    weight = problem.constraints.soft.soft_break
    advanced = problem.constraints.advanced
    if not weight:
        return []
    day_index = {day: i for i, day in enumerate(problem.time_structure.days)}
    terms: Terms = []
    for i, brk in enumerate(advanced.global_breaks):
        if not is_softened(advanced, "break", str(i)):
            continue
        day_idx = day_index.get(brk.day)
        if day_idx is None:
            continue
        for slot in brk.slots:
            for subject in problem.subjects:
                var = variables.assignments.get((subject.id, day_idx, slot))
                if var is not None:
                    terms.append(weight * var)
    return terms


def add_soft_allowed_slots_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Penalize a softened subject scheduled outside its allowed slots (rule 3, soft)."""
    weight = problem.constraints.soft.soft_allowed_slots
    advanced = problem.constraints.advanced
    if not weight:
        return []
    terms: Terms = []
    for subject in problem.subjects:
        if subject.allowed_slots is None or not is_softened(advanced, "allowed_slots", subject.id):
            continue
        allowed = set(subject.allowed_slots)
        for (sid, _day_idx, slot), var in variables.assignments.items():
            if sid == subject.id and slot not in allowed:
                terms.append(weight * var)
    return terms


def add_soft_teacher_cap_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Penalize hours over a softened teacher's daily cap (rule 5-H, soft)."""
    weight = problem.constraints.soft.soft_teacher_cap
    advanced = problem.constraints.advanced
    if not weight:
        return []
    terms: Terms = []
    for teacher_id, cap in advanced.hard_teacher_daily_caps.items():
        if not is_softened(advanced, "teacher_cap", teacher_id):
            continue
        subject_ids = [s.id for s in problem.subjects if teacher_id in s.teacher_ids]
        if not subject_ids:
            continue
        for day_idx, day in enumerate(problem.time_structure.days):
            slots = problem.time_structure.get_slots_for_day(day)
            day_vars = [
                variables.assignments[(sid, day_idx, slot)]
                for sid in subject_ids
                for slot in range(1, slots + 1)
            ]
            if len(day_vars) <= cap:
                continue
            over = positive_part(
                model, sum(day_vars) - cap, len(day_vars), f"softcap_{teacher_id}_{day_idx}"
            )
            terms.append(weight * over)
    return terms


def add_soft_same_day_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Penalize days where both subjects of a softened exclusion appear (rule 22, soft)."""
    weight = problem.constraints.soft.soft_same_day
    advanced = problem.constraints.advanced
    if not weight:
        return []
    terms: Terms = []
    for i, pair in enumerate(advanced.same_day_exclusions):
        if not is_softened(advanced, "same_day", str(i)):
            continue
        for day_idx in range(len(problem.time_structure.days)):
            a = present_on_day(model, variables, pair.first, day_idx)
            b = present_on_day(model, variables, pair.second, day_idx)
            if a is None or b is None:
                continue
            both = model.new_bool_var(f"softsameday_{i}_{day_idx}")
            model.add_min_equality(both, [a, b])
            terms.append(weight * both)
    return terms


def add_soft_ordering_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Penalize a softened ordering when `second` starts at or before `first` (rule 23, soft)."""
    weight = problem.constraints.soft.soft_ordering
    advanced = problem.constraints.advanced
    if not weight:
        return []
    days = problem.time_structure.days
    max_slots = max(problem.time_structure.get_slots_for_day(d) for d in days)
    big = len(days) * max_slots + 1
    terms: Terms = []
    for i, pair in enumerate(advanced.orderings):
        if not is_softened(advanced, "ordering", str(i)):
            continue
        first = first_index(model, variables, pair.first, max_slots, big)
        second = first_index(model, variables, pair.second, max_slots, big)
        if first is None or second is None:
            continue
        # >= 1 exactly when first starts at or after second (the violation), else 0.
        violation = positive_part(model, first - second + 1, big + 1, f"softorder_{i}")
        terms.append(weight * violation)
    return terms
