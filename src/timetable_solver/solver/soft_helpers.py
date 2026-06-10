"""Shared auxiliary-variable builders for soft constraint penalties.

All helpers assume the objective is MINIMIZED. Variables built for penalties
use lower-bound-only linearization (the objective drives them down); variables
built for rewards use upper bounds (the objective drives them up).
"""

from ortools.sat.python import cp_model

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.solver.variables import SolverVariables

# day_index -> one busy/occupied BoolVar per slot (list index = slot - 1)
DayOccupancy = dict[int, list[cp_model.IntVar]]


def occupancy_vars(
    model: cp_model.CpModel,
    variables: SolverVariables,
    problem: TimetableProblem,
    subject_ids: list[str],
    prefix: str,
) -> DayOccupancy:
    """Exact per-slot occupancy booleans for the union of the given subjects.

    occupied[d][t-1] == OR over the subjects' assignment variables at (d, t).
    Built with add_max_equality, so values are exact in both directions and the
    result is safe for penalty and reward terms alike.
    """
    occupancy: DayOccupancy = {}
    for day_idx, day in enumerate(problem.time_structure.days):
        slots = problem.time_structure.get_slots_for_day(day)
        per_slot: list[cp_model.IntVar] = []
        for slot in range(1, slots + 1):
            slot_vars = [variables.assignments[(sid, day_idx, slot)] for sid in subject_ids]
            busy = model.new_bool_var(f"{prefix}_busy_{day_idx}_{slot}")
            if slot_vars:
                model.add_max_equality(busy, slot_vars)
            else:
                model.add(busy == 0)
            per_slot.append(busy)
        occupancy[day_idx] = per_slot
    return occupancy


def hole_vars(
    model: cp_model.CpModel,
    occupied: list[cp_model.IntVar],
    prefix: str,
    for_reward: bool = False,
) -> list[cp_model.IntVar]:
    """Booleans marking empty slots strictly inside a day's occupied span.

    A "hole" is a free slot with at least one class before AND after it on the
    same day. The number of holes equals (span - class count), i.e. the gap.

    Args:
        model: CP-SAT model.
        occupied: Exact occupancy booleans for one day, slot order.
        prefix: Variable name prefix.
        for_reward: Build upper-bounded holes (for negative objective terms)
            instead of lower-bounded ones (for positive terms).

    Returns:
        One boolean per interior slot (possibly empty for short days).
    """
    count = len(occupied)
    if count < 3:
        return []
    before = _prefix_or(model, occupied, f"{prefix}_before")
    after = _prefix_or(model, list(reversed(occupied)), f"{prefix}_after")[::-1]
    holes: list[cp_model.IntVar] = []
    for i in range(1, count - 1):
        hole = model.new_bool_var(f"{prefix}_hole_{i}")
        if for_reward:
            model.add(hole <= before[i - 1])
            model.add(hole <= after[i + 1])
            model.add(hole <= 1 - occupied[i])
        else:
            model.add(hole >= before[i - 1] + after[i + 1] - occupied[i] - 1)
        holes.append(hole)
    return holes


def positive_part(
    model: cp_model.CpModel,
    expression: cp_model.LinearExpr,
    upper_bound: int,
    name: str,
) -> cp_model.IntVar:
    """An IntVar equal to max(0, expression) at any minimizing optimum.

    Lower-bound-only encoding: ONLY valid as a positive (penalty) objective term.
    """
    var = model.new_int_var(0, upper_bound, name)
    model.add(var >= expression)
    return var


def teacher_subject_ids(problem: TimetableProblem, teacher_id: str) -> list[str]:
    """IDs of all subjects taught by the given teacher."""
    return [s.id for s in problem.subjects if teacher_id in s.teacher_ids]


class TeacherBusyCache:
    """Lazily builds exact per-teacher occupancy booleans, shared across penalties."""

    def __init__(
        self,
        model: cp_model.CpModel,
        variables: SolverVariables,
        problem: TimetableProblem,
    ) -> None:
        self._model = model
        self._variables = variables
        self._problem = problem
        self._cache: dict[str, DayOccupancy] = {}

    def get(self, teacher_id: str) -> DayOccupancy:
        """Occupancy booleans for one teacher, built on first request."""
        if teacher_id not in self._cache:
            subject_ids = teacher_subject_ids(self._problem, teacher_id)
            self._cache[teacher_id] = occupancy_vars(
                self._model, self._variables, self._problem, subject_ids, f"t_{teacher_id}"
            )
        return self._cache[teacher_id]


def _prefix_or(
    model: cp_model.CpModel, items: list[cp_model.IntVar], prefix: str
) -> list[cp_model.IntVar]:
    """running[i] == OR(items[0..i]), built incrementally and exactly."""
    running: list[cp_model.IntVar] = []
    for i, item in enumerate(items):
        accumulated = model.new_bool_var(f"{prefix}_{i}")
        sources = [item] if i == 0 else [running[i - 1], item]
        model.add_max_equality(accumulated, sources)
        running.append(accumulated)
    return running
