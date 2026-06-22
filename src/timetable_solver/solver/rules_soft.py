"""Soft rule generators for M7 advanced constraints (rules 15, 26, 27, 28).

Each builder returns a list of weighted penalty Terms (LinearExpr), gated on its
SoftConstraints weight, folded into soft.add_soft_objectives. All terms are
positive penalties, consistent with the minimized objective.
"""

from ortools.sat.python import cp_model

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.solver.soft_helpers import occupancy_vars, positive_part
from timetable_solver.solver.variables import SolverVariables

Terms = list[cp_model.LinearExpr]


def add_group_balance_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Rule 28: balance each group's hours evenly across days (group analog of
    teacher workload_balance).

    Weekly totals are fixed by the input, so this penalizes the deviation of each
    day's hours from the group's daily mean, integer-scaled by the day count:
    |D * hours[d] - week_hours|.
    """
    weight = problem.constraints.soft.group_workload_balance
    if not weight:
        return []
    day_count = len(problem.time_structure.days)
    bound = day_count * problem.time_structure.total_slots()
    terms: Terms = []
    for group in problem.student_groups:
        subjects = [s for s in problem.subjects if group.id in s.group_ids]
        week_hours = sum(s.hours_per_week for s in subjects)
        if week_hours == 0:
            continue
        for day_idx, day in enumerate(problem.time_structure.days):
            slots = problem.time_structure.get_slots_for_day(day)
            day_hours = sum(
                variables.assignments[(s.id, day_idx, t)]
                for s in subjects
                for t in range(1, slots + 1)
            )
            deviation = model.new_int_var(0, bound, f"gdev_{group.id}_{day_idx}")
            model.add(deviation >= day_count * day_hours - week_hours)
            model.add(deviation >= week_hours - day_count * day_hours)
            terms.append(weight * deviation)
    return terms


def add_back_to_back_lab_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Rule 27: discourage a group's lab sessions in adjacent slots.

    For each adjacent slot pair, a reified boolean lower-bounds AND(occupied[t],
    occupied[t+1]); the minimized objective drives it to zero whenever the labs
    can be separated.
    """
    weight = problem.constraints.soft.avoid_consecutive_labs
    if not weight:
        return []
    terms: Terms = []
    for group in problem.student_groups:
        lab_ids = [s.id for s in problem.subjects if group.id in s.group_ids and s.type == "lab"]
        if not lab_ids:
            continue
        occupancy = occupancy_vars(model, variables, problem, lab_ids, f"lab_{group.id}")
        for day_idx, occupied in occupancy.items():
            for t in range(len(occupied) - 1):
                adjacent = model.new_bool_var(f"labadj_{group.id}_{day_idx}_{t}")
                model.add(adjacent >= occupied[t] + occupied[t + 1] - 1)
                terms.append(weight * adjacent)
    return terms


def _halfday_slots(slots: int, half: str) -> range:
    """Slot numbers in a day's morning or afternoon (morning is the lower half)."""
    mid = (slots + 1) // 2
    if half == "morning":
        return range(1, mid + 1)
    return range(mid + 1, slots + 1)


def add_group_free_halfday_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Rule 15: prefer a group's requested half-day be free of classes."""
    weight = problem.constraints.soft.group_free_halfday
    requests = problem.constraints.advanced.group_free_halfdays
    if not weight or not requests:
        return []
    day_index = {day: i for i, day in enumerate(problem.time_structure.days)}
    terms: Terms = []
    for req in requests:
        day_idx = day_index.get(req.day)
        if day_idx is None:
            continue
        subject_ids = [s.id for s in problem.subjects if req.group_id in s.group_ids]
        slots = problem.time_structure.get_slots_for_day(req.day)
        for slot in _halfday_slots(slots, req.half):
            for sid in subject_ids:
                var = variables.assignments.get((sid, day_idx, slot))
                if var is not None:
                    terms.append(weight * var)
    return terms


def add_same_room_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Rule 26: prefer a subject keep a single room across all its sessions.

    For each room the subject may use, a boolean records whether it is ever used
    there (an OR over that room's choice vars); the penalty is the positive part
    of (distinct rooms used - 1), driven to zero when one room serves every hour.
    """
    weight = problem.constraints.soft.same_room
    subject_ids = problem.constraints.advanced.same_room_subjects
    if not weight or not subject_ids:
        return []
    terms: Terms = []
    for sid in subject_ids:
        room_ids = sorted({rid for (s, _, _, rid) in variables.room_choices if s == sid})
        used = []
        for rid in room_ids:
            choices = [
                var for (s, _, _, r), var in variables.room_choices.items() if s == sid and r == rid
            ]
            ever = model.new_bool_var(f"uses_{sid}_{rid}")
            model.add_max_equality(ever, choices)
            used.append(ever)
        if len(used) <= 1:
            continue
        extra = positive_part(model, sum(used) - 1, len(used), f"rooms_{sid}")
        terms.append(weight * extra)
    return terms
