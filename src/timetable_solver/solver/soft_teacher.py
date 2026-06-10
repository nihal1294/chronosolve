"""Soft penalties driven by TeacherPreferences (style, consecutive, hours, days)."""

from ortools.sat.python import cp_model

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.teacher import Teacher, TeacherPreferences
from timetable_solver.solver.soft_helpers import (
    TeacherBusyCache,
    hole_vars,
    positive_part,
    teacher_subject_ids,
)
from timetable_solver.solver.variables import SolverVariables

Terms = list[cp_model.LinearExpr]


def add_teacher_preference_penalties(
    model: cp_model.CpModel,
    variables: SolverVariables,
    problem: TimetableProblem,
    busy_cache: TeacherBusyCache,
) -> Terms:
    """All TeacherPreferences-driven penalty terms for every teacher."""
    terms: Terms = []
    weights = problem.constraints.soft
    for teacher in problem.teachers:
        prefs = teacher.preferences
        if prefs is None:
            continue
        if weights.compact_schedules and prefs.schedule_style:
            terms += _style_terms(model, busy_cache, teacher, prefs, weights.compact_schedules)
        if weights.avoid_consecutive_hours and prefs.consecutive_hours:
            terms += _consecutive_terms(
                model, busy_cache, teacher, prefs, weights.avoid_consecutive_hours
            )
        if weights.leave_early and prefs.leave_early:
            terms += _leave_early_terms(model, variables, problem, teacher, weights.leave_early)
        if weights.max_hours_per_day and prefs.max_hours_per_day:
            terms += _max_hours_terms(
                model, variables, problem, teacher, weights.max_hours_per_day
            )
        if weights.free_days and prefs.min_free_days:
            terms += _free_days_terms(model, variables, problem, teacher, weights.free_days)
    return terms


def _style_terms(
    model: cp_model.CpModel,
    busy_cache: TeacherBusyCache,
    teacher: Teacher,
    prefs: TeacherPreferences,
    weight: int,
) -> Terms:
    """Compact style penalizes holes; spread style rewards them."""
    reward = prefs.schedule_style == "spread"
    sign = -1 if reward else 1
    terms: Terms = []
    for day_idx, occupied in busy_cache.get(teacher.id).items():
        holes = hole_vars(model, occupied, f"style_{teacher.id}_{day_idx}", for_reward=reward)
        terms += [sign * weight * hole for hole in holes]
    return terms


def _consecutive_terms(
    model: cp_model.CpModel,
    busy_cache: TeacherBusyCache,
    teacher: Teacher,
    prefs: TeacherPreferences,
    weight: int,
) -> Terms:
    """Penalize or reward back-to-back slots; cap preferred run lengths."""
    avoid = prefs.consecutive_hours == "avoid"
    terms: Terms = []
    for day_idx, occupied in busy_cache.get(teacher.id).items():
        for i in range(len(occupied) - 1):
            pair = model.new_bool_var(f"adj_{teacher.id}_{day_idx}_{i}")
            if avoid:
                model.add(pair >= occupied[i] + occupied[i + 1] - 1)
                terms.append(weight * pair)
            else:
                model.add(pair <= occupied[i])
                model.add(pair <= occupied[i + 1])
                terms.append(-weight * pair)
        if not avoid and prefs.max_consecutive:
            terms += _run_cap_terms(model, occupied, teacher.id, day_idx, prefs, weight)
    return terms


def _run_cap_terms(
    model: cp_model.CpModel,
    occupied: list[cp_model.IntVar],
    teacher_id: str,
    day_idx: int,
    prefs: TeacherPreferences,
    weight: int,
) -> Terms:
    """Penalize every window of max_consecutive+1 fully-busy slots."""
    cap = prefs.max_consecutive or 0
    terms: Terms = []
    for start in range(len(occupied) - cap):
        window = occupied[start : start + cap + 1]
        excess = positive_part(
            model, sum(window) - cap, 1, f"run_{teacher_id}_{day_idx}_{start}"
        )
        terms.append(weight * excess)
    return terms


def _leave_early_terms(
    model: cp_model.CpModel,
    variables: SolverVariables,
    problem: TimetableProblem,
    teacher: Teacher,
    weight: int,
) -> Terms:
    """Penalize each scheduled hour after the teacher's per-day cutoff slot."""
    assert teacher.preferences is not None
    subject_ids = teacher_subject_ids(problem, teacher.id)
    day_index = {day: i for i, day in enumerate(problem.time_structure.days)}
    terms: Terms = []
    for day, cutoff in teacher.preferences.leave_early.items():
        day_idx = day_index[day]
        slots = problem.time_structure.get_slots_for_day(day)
        for slot in range(cutoff + 1, slots + 1):
            for sid in subject_ids:
                terms.append(weight * variables.assignments[(sid, day_idx, slot)])
    return terms


def _max_hours_terms(
    model: cp_model.CpModel,
    variables: SolverVariables,
    problem: TimetableProblem,
    teacher: Teacher,
    weight: int,
) -> Terms:
    """Penalize daily teaching hours beyond the teacher's soft cap."""
    assert teacher.preferences is not None
    cap = teacher.preferences.max_hours_per_day or 0
    subject_ids = teacher_subject_ids(problem, teacher.id)
    terms: Terms = []
    for day_idx, day in enumerate(problem.time_structure.days):
        slots = problem.time_structure.get_slots_for_day(day)
        hours = sum(
            variables.assignments[(sid, day_idx, t)]
            for sid in subject_ids
            for t in range(1, slots + 1)
        )
        excess = positive_part(model, hours - cap, slots, f"maxh_{teacher.id}_{day_idx}")
        terms.append(weight * excess)
    return terms


def _free_days_terms(
    model: cp_model.CpModel,
    variables: SolverVariables,
    problem: TimetableProblem,
    teacher: Teacher,
    weight: int,
) -> Terms:
    """Penalize the shortfall below the teacher's desired free days per week."""
    assert teacher.preferences is not None
    wanted = teacher.preferences.min_free_days or 0
    subject_ids = teacher_subject_ids(problem, teacher.id)
    day_count = len(problem.time_structure.days)
    has_class: list[cp_model.IntVar] = []
    for day_idx, day in enumerate(problem.time_structure.days):
        slots = problem.time_structure.get_slots_for_day(day)
        day_vars = [
            variables.assignments[(sid, day_idx, t)]
            for sid in subject_ids
            for t in range(1, slots + 1)
        ]
        flag = model.new_bool_var(f"hasclass_{teacher.id}_{day_idx}")
        model.add(slots * len(subject_ids) * flag >= sum(day_vars))
        has_class.append(flag)
    shortfall = positive_part(
        model, wanted - day_count + sum(has_class), day_count, f"freedays_{teacher.id}"
    )
    return [weight * shortfall]
