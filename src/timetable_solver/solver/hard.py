"""Hard constraint builders — each adds one inviolable rule to the CP-SAT model.

Room-related hard constraints live in solver/rooms.py.
"""

from ortools.sat.python import cp_model

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.solver.variables import SolverVariables, block_size


def add_required_hours(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """Each subject is scheduled exactly hours_per_week times.

    Block subjects additionally get their block-count form
    (hours_per_week / consecutive_hours blocks), which is equivalent but
    propagates better alongside the channeling constraints.
    """
    if not problem.constraints.hard.required_hours:
        return
    for subject in problem.subjects:
        hour_vars = _subject_assignment_vars(variables, subject.id)
        model.add(sum(hour_vars) == subject.hours_per_week)
        size = block_size(subject)
        if size > 1:
            starts = _subject_block_vars(variables, subject.id)
            model.add(sum(starts) == subject.hours_per_week // size)


def add_teacher_no_clash(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """A teacher teaches at most one subject per timeslot."""
    if not problem.constraints.hard.teacher_no_clash:
        return
    for teacher in problem.teachers:
        subject_ids = [s.id for s in problem.subjects if teacher.id in s.teacher_ids]
        _add_no_clash_per_slot(model, variables, problem, subject_ids)


def add_group_no_clash(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """A student group attends at most one subject per timeslot."""
    if not problem.constraints.hard.group_no_clash:
        return
    for group in problem.student_groups:
        subject_ids = [s.id for s in problem.subjects if group.id in s.group_ids]
        _add_no_clash_per_slot(model, variables, problem, subject_ids)


def add_availability(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """Force assignments to zero wherever a teacher or group is unavailable."""
    if not problem.constraints.hard.respect_availability:
        return
    day_index = {day: i for i, day in enumerate(problem.time_structure.days)}
    for teacher in problem.teachers:
        subject_ids = [s.id for s in problem.subjects if teacher.id in s.teacher_ids]
        _block_slots(model, variables, subject_ids, teacher.unavailable, day_index)
    for group in problem.student_groups:
        subject_ids = [s.id for s in problem.subjects if group.id in s.group_ids]
        _block_slots(model, variables, subject_ids, group.unavailable, day_index)


def add_consecutive_blocks(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """Channel block-start variables to slot assignments for block subjects.

    x[s,d,t] == sum of block_starts whose span covers slot t. This enforces
    contiguity and forbids overlapping blocks in one constraint per slot.
    """
    for subject in problem.subjects:
        size = block_size(subject)
        if size <= 1:
            continue
        for day_idx, day in enumerate(problem.time_structure.days):
            slots = problem.time_structure.get_slots_for_day(day)
            for slot in range(1, slots + 1):
                covering = [
                    variables.block_starts[(subject.id, day_idx, start)]
                    for start in range(max(1, slot - size + 1), slot + 1)
                    if (subject.id, day_idx, start) in variables.block_starts
                ]
                assignment = variables.assignments[(subject.id, day_idx, slot)]
                model.add(assignment == sum(covering))


def add_max_per_day(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """Cap daily sessions per subject: blocks for block subjects, hours otherwise."""
    for subject in problem.subjects:
        use_blocks = block_size(subject) > 1
        for day_idx, day in enumerate(problem.time_structure.days):
            if use_blocks:
                session_vars = [
                    var
                    for (sid, d, _), var in variables.block_starts.items()
                    if sid == subject.id and d == day_idx
                ]
            else:
                slots = problem.time_structure.get_slots_for_day(day)
                session_vars = [
                    variables.assignments[(subject.id, day_idx, t)]
                    for t in range(1, slots + 1)
                ]
            if len(session_vars) > subject.max_per_day:
                model.add(sum(session_vars) <= subject.max_per_day)


def add_pre_assignments(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """Fix pre-assigned slots. For block subjects the slot is the block start."""
    day_index = {day: i for i, day in enumerate(problem.time_structure.days)}
    subjects = {s.id: s for s in problem.subjects}
    for pre in problem.pre_assignments:
        subject = subjects[pre.subject_id]
        key = (pre.subject_id, day_index[pre.day], pre.slot)
        if block_size(subject) > 1:
            model.add(variables.block_starts[key] == 1)
        else:
            model.add(variables.assignments[key] == 1)


def _subject_assignment_vars(
    variables: SolverVariables, subject_id: str
) -> list[cp_model.IntVar]:
    """All assignment booleans belonging to one subject."""
    return [var for (sid, _, _), var in variables.assignments.items() if sid == subject_id]


def _subject_block_vars(
    variables: SolverVariables, subject_id: str
) -> list[cp_model.IntVar]:
    """All block-start booleans belonging to one subject."""
    return [var for (sid, _, _), var in variables.block_starts.items() if sid == subject_id]


def _add_no_clash_per_slot(
    model: cp_model.CpModel,
    variables: SolverVariables,
    problem: TimetableProblem,
    subject_ids: list[str],
) -> None:
    """At most one of the given subjects may occupy any single (day, slot)."""
    if len(subject_ids) < 2:
        return
    for day_idx, day in enumerate(problem.time_structure.days):
        for slot in range(1, problem.time_structure.get_slots_for_day(day) + 1):
            slot_vars = [variables.assignments[(sid, day_idx, slot)] for sid in subject_ids]
            model.add_at_most_one(slot_vars)


def _block_slots(
    model: cp_model.CpModel,
    variables: SolverVariables,
    subject_ids: list[str],
    unavailable: dict[str, list[int]],
    day_index: dict[str, int],
) -> None:
    """Zero out assignments for the given subjects on unavailable (day, slot) pairs."""
    for day, slots in unavailable.items():
        for slot in slots:
            for sid in subject_ids:
                var = variables.assignments.get((sid, day_index[day], slot))
                if var is not None:
                    model.add(var == 0)
