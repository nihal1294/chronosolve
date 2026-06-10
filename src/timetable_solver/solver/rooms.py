"""Room assignment constraints — channeling, no-clash, and block continuity.

Only active when the problem defines rooms. Room *type* compatibility is hard
(enforced by variable creation); capacity is soft (validator warning only).
"""

from ortools.sat.python import cp_model

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.solver.variables import SolverVariables, block_size, compatible_rooms


def add_room_constraints(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """Add all room-related constraints (no-op when the problem has no rooms)."""
    if not problem.rooms:
        return
    _channel_rooms_to_assignments(model, variables, problem)
    if problem.constraints.hard.room_no_clash:
        _add_room_no_clash(model, variables, problem)
    _add_block_room_continuity(model, variables, problem)


def _channel_rooms_to_assignments(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """Every scheduled hour uses exactly one compatible room; unscheduled hours none."""
    for subject in problem.subjects:
        rooms = compatible_rooms(subject, problem.rooms)
        for day_idx, day in enumerate(problem.time_structure.days):
            for slot in range(1, problem.time_structure.get_slots_for_day(day) + 1):
                choices = [
                    variables.room_choices[(subject.id, day_idx, slot, room.id)]
                    for room in rooms
                ]
                assignment = variables.assignments[(subject.id, day_idx, slot)]
                model.add(sum(choices) == assignment)


def _add_room_no_clash(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """A room hosts at most one subject per timeslot."""
    occupancy: dict[tuple[str, int, int], list[cp_model.IntVar]] = {}
    for (_, day_idx, slot, room_id), var in variables.room_choices.items():
        occupancy.setdefault((room_id, day_idx, slot), []).append(var)
    for slot_vars in occupancy.values():
        if len(slot_vars) > 1:
            model.add_at_most_one(slot_vars)


def _add_block_room_continuity(
    model: cp_model.CpModel, variables: SolverVariables, problem: TimetableProblem
) -> None:
    """Consecutive-block subjects keep the same room across adjacent occupied slots."""
    for subject in problem.subjects:
        if block_size(subject) <= 1:
            continue
        rooms = compatible_rooms(subject, problem.rooms)
        for day_idx, day in enumerate(problem.time_structure.days):
            slots = problem.time_structure.get_slots_for_day(day)
            for slot in range(1, slots):
                here = variables.assignments[(subject.id, day_idx, slot)]
                there = variables.assignments[(subject.id, day_idx, slot + 1)]
                for room in rooms:
                    choice_here = variables.room_choices[(subject.id, day_idx, slot, room.id)]
                    choice_next = variables.room_choices[(subject.id, day_idx, slot + 1, room.id)]
                    model.add(choice_here == choice_next).only_enforce_if([here, there])
