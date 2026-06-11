"""CP-SAT variable creation - the boolean encoding of a timetable problem."""

from dataclasses import dataclass, field

from ortools.sat.python import cp_model

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.room import Room, room_type_matches
from timetable_solver.models.subject import Subject

AssignKey = tuple[str, int, int]  # (subject_id, day_index, slot)
BlockKey = tuple[str, int, int]  # (subject_id, day_index, start_slot)
RoomKey = tuple[str, int, int, str]  # (subject_id, day_index, slot, room_id)


@dataclass
class SolverVariables:
    """All CP-SAT decision variables for one problem.

    Attributes:
        assignments: x[subject, day, slot] - subject occupies this slot.
        block_starts: block[subject, day, start] - a consecutive block of the
            subject begins at this slot (only for subjects with consecutive_hours > 1).
        room_choices: room[subject, day, slot, room] - scheduled hour uses this room
            (only when the problem defines rooms; restricted to type-compatible rooms).
    """

    assignments: dict[AssignKey, cp_model.IntVar] = field(default_factory=dict)
    block_starts: dict[BlockKey, cp_model.IntVar] = field(default_factory=dict)
    room_choices: dict[RoomKey, cp_model.IntVar] = field(default_factory=dict)


def block_size(subject: Subject) -> int:
    """Return the consecutive block length for a subject (1 = no block requirement)."""
    return subject.consecutive_hours or 1


def compatible_rooms(subject: Subject, rooms: list[Room]) -> list[Room]:
    """Rooms a subject may use: type must match its preference ("any" matches all).

    Capacity is deliberately not filtered here - it is a soft concern
    (validator warning), matching the validation contract.
    """
    return [r for r in rooms if room_type_matches(r.type, subject.preferred_room_type)]


def create_variables(model: cp_model.CpModel, problem: TimetableProblem) -> SolverVariables:
    """Create the full variable grid for a problem.

    Args:
        model: CP-SAT model to add variables to.
        problem: Validated timetable problem.

    Returns:
        SolverVariables holding assignment, block-start, and room-choice booleans.
    """
    variables = SolverVariables()
    _create_assignments(model, problem, variables)
    _create_block_starts(model, problem, variables)
    _create_room_choices(model, problem, variables)
    return variables


def _create_assignments(
    model: cp_model.CpModel, problem: TimetableProblem, variables: SolverVariables
) -> None:
    """One boolean per (subject, day, slot) within each day's slot count."""
    for subject in problem.subjects:
        for day_index, day in enumerate(problem.time_structure.days):
            for slot in range(1, problem.time_structure.get_slots_for_day(day) + 1):
                key = (subject.id, day_index, slot)
                variables.assignments[key] = model.new_bool_var(
                    f"x_{subject.id}_{day_index}_{slot}"
                )


def _create_block_starts(
    model: cp_model.CpModel, problem: TimetableProblem, variables: SolverVariables
) -> None:
    """Booleans for every feasible block start of consecutive-hour subjects."""
    for subject in problem.subjects:
        size = block_size(subject)
        if size <= 1:
            continue
        for day_index, day in enumerate(problem.time_structure.days):
            last_start = problem.time_structure.get_slots_for_day(day) - size + 1
            for start in range(1, last_start + 1):
                key = (subject.id, day_index, start)
                variables.block_starts[key] = model.new_bool_var(
                    f"block_{subject.id}_{day_index}_{start}"
                )


def _create_room_choices(
    model: cp_model.CpModel, problem: TimetableProblem, variables: SolverVariables
) -> None:
    """Booleans pairing each potential scheduled hour with a compatible room."""
    if not problem.rooms:
        return
    for subject in problem.subjects:
        rooms = compatible_rooms(subject, problem.rooms)
        for day_index, day in enumerate(problem.time_structure.days):
            for slot in range(1, problem.time_structure.get_slots_for_day(day) + 1):
                for room in rooms:
                    key = (subject.id, day_index, slot, room.id)
                    variables.room_choices[key] = model.new_bool_var(
                        f"room_{subject.id}_{day_index}_{slot}_{room.id}"
                    )
