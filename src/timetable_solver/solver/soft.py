"""Soft constraint penalties - gap/spread/preference terms and objective assembly."""

from ortools.sat.python import cp_model

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.solver.soft_helpers import (
    TeacherBusyCache,
    hole_vars,
    occupancy_vars,
    positive_part,
)
from timetable_solver.solver.soft_teacher import add_teacher_preference_penalties
from timetable_solver.solver.variables import SolverVariables, block_size

Terms = list[cp_model.LinearExpr]


def add_soft_objectives(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """Assemble the weighted soft-constraint objective (no-op if all weights are 0)."""
    busy_cache = TeacherBusyCache(model, variables, problem)
    terms: Terms = []
    terms += add_student_gap_penalty(model, variables, problem)
    terms += add_teacher_gap_penalty(model, problem, busy_cache)
    terms += add_subject_spread_penalty(model, variables, problem)
    terms += add_time_preference_penalty(model, variables, problem)
    terms += add_workload_balance_penalty(model, variables, problem)
    terms += add_teacher_preference_penalties(model, variables, problem, busy_cache)
    if terms:
        model.minimize(sum(terms))


def add_student_gap_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Penalize free slots between a group's first and last class of each day."""
    weight = problem.constraints.soft.minimize_student_gaps
    if not weight:
        return []
    terms: Terms = []
    for group in problem.student_groups:
        subject_ids = [s.id for s in problem.subjects if group.id in s.group_ids]
        occupancy = occupancy_vars(model, variables, problem, subject_ids, f"g_{group.id}")
        for day_idx, occupied in occupancy.items():
            holes = hole_vars(model, occupied, f"ggap_{group.id}_{day_idx}")
            terms += [weight * hole for hole in holes]
    return terms


def add_teacher_gap_penalty(
    model: cp_model.CpModel, problem: TimetableProblem, busy_cache: TeacherBusyCache
) -> Terms:
    """Penalize free slots between a teacher's first and last class of each day."""
    weight = problem.constraints.soft.minimize_teacher_gaps
    if not weight:
        return []
    terms: Terms = []
    for teacher in problem.teachers:
        for day_idx, occupied in busy_cache.get(teacher.id).items():
            holes = hole_vars(model, occupied, f"tgap_{teacher.id}_{day_idx}")
            terms += [weight * hole for hole in holes]
    return terms


def add_subject_spread_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Penalize a subject occurring more than one session on the same day."""
    weight = problem.constraints.soft.spread_subjects
    if not weight:
        return []
    terms: Terms = []
    for subject in problem.subjects:
        use_blocks = block_size(subject) > 1
        source = variables.block_starts if use_blocks else variables.assignments
        for day_idx, day in enumerate(problem.time_structure.days):
            sessions = [
                var for (sid, d, _), var in source.items() if sid == subject.id and d == day_idx
            ]
            if len(sessions) <= 1:
                continue
            slots = problem.time_structure.get_slots_for_day(day)
            extra = positive_part(model, sum(sessions) - 1, slots, f"spread_{subject.id}_{day_idx}")
            terms.append(weight * extra)
    return terms


def add_time_preference_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Penalize 'avoid' slots and reward 'preferred' slots for each teacher."""
    weight = problem.constraints.soft.teacher_time_preferences
    if not weight:
        return []
    day_index = {day: i for i, day in enumerate(problem.time_structure.days)}
    terms: Terms = []
    for teacher in problem.teachers:
        if teacher.preferences is None or not teacher.preferences.slot_preferences:
            continue
        subject_ids = [s.id for s in problem.subjects if teacher.id in s.teacher_ids]
        for day, slot_prefs in teacher.preferences.slot_preferences.items():
            for slot, preference in slot_prefs.items():
                sign = 1 if preference == "avoid" else -1
                for sid in subject_ids:
                    var = variables.assignments.get((sid, day_index[day], slot))
                    if var is not None:
                        terms.append(sign * weight * var)
    return terms


def add_workload_balance_penalty(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> Terms:
    """Balance each teacher's hours evenly across days.

    Weekly totals are fixed by the input, so this penalizes the deviation of
    each day's hours from the teacher's own daily mean, integer-scaled by the
    number of days: |D * hours[d] - week_hours|.
    """
    weight = problem.constraints.soft.workload_balance
    if not weight:
        return []
    day_count = len(problem.time_structure.days)
    bound = day_count * problem.time_structure.total_slots()
    terms: Terms = []
    for teacher in problem.teachers:
        subjects = [s for s in problem.subjects if teacher.id in s.teacher_ids]
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
            deviation = model.new_int_var(0, bound, f"dev_{teacher.id}_{day_idx}")
            model.add(deviation >= day_count * day_hours - week_hours)
            model.add(deviation >= week_hours - day_count * day_hours)
            terms.append(weight * deviation)
    return terms
