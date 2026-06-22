"""Auxiliary CP-SAT variable builders shared by the hard rule generators.

Parallels solver/soft_helpers.py (which serves the soft penalties): small pure
functions that introduce derived booleans/ints over the assignment grid.
"""

from ortools.sat.python import cp_model

from timetable_solver.solver.variables import SolverVariables


def present_on_day(
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


def first_index(
    model: cp_model.CpModel,
    variables: SolverVariables,
    subject_id: str,
    max_slots: int,
    big: int,
) -> cp_model.IntVar | None:
    """An int var = earliest global (day*max_slots + slot) the subject occupies, else big.

    Each candidate slot contributes `big - (big - g) * occ`, which evaluates to the
    global index g when occupied (occ=1) and the sentinel `big` when not (occ=0);
    the min over those is the subject's first occupied position (big if never scheduled).
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
