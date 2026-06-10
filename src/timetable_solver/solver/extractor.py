"""Read CP-SAT solver output into SolveResult models."""

from ortools.sat.python import cp_model

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import ScheduleEntry, SolveResult, SolverStatus
from timetable_solver.solver.variables import SolverVariables

_STATUS_MAP: dict[int, SolverStatus] = {
    cp_model.OPTIMAL: "optimal",
    cp_model.FEASIBLE: "feasible",
    cp_model.INFEASIBLE: "infeasible",
    cp_model.UNKNOWN: "timeout",
}


class SolverError(Exception):
    """Raised when CP-SAT reports the model itself is invalid (a solver bug)."""


def extract_solution(
    solver: cp_model.CpSolver,
    status: int,
    variables: SolverVariables,
    problem: TimetableProblem,
) -> SolveResult:
    """Convert a finished CP-SAT solve into a SolveResult.

    Args:
        solver: The solver after solve() returned.
        status: CP-SAT status code returned by solve().
        variables: Variables the model was built with.
        problem: The original problem (for day names and subject metadata).

    Returns:
        SolveResult with mapped status, schedule entries, and unresolved subjects.

    Raises:
        SolverError: If CP-SAT reports MODEL_INVALID.
    """
    if status == cp_model.MODEL_INVALID:
        raise SolverError("CP-SAT rejected the model as invalid — this is a solver bug")
    mapped = _STATUS_MAP[status]
    if mapped in ("infeasible", "timeout"):
        return SolveResult(
            status=mapped,
            schedule=[],
            solve_time_seconds=solver.wall_time,
            unresolved=[s.id for s in problem.subjects],
        )
    schedule = _build_entries(solver, variables, problem)
    return SolveResult(
        status=mapped,
        schedule=schedule,
        solve_time_seconds=solver.wall_time,
        unresolved=_find_unresolved(schedule, problem),
    )


def _build_entries(
    solver: cp_model.CpSolver,
    variables: SolverVariables,
    problem: TimetableProblem,
) -> list[ScheduleEntry]:
    """Build sorted ScheduleEntry objects from assigned variables."""
    subjects = {s.id: s for s in problem.subjects}
    rooms_at = _solved_rooms(solver, variables)
    entries: list[ScheduleEntry] = []
    for (subject_id, day_idx, slot), var in variables.assignments.items():
        if not solver.value(var):
            continue
        subject = subjects[subject_id]
        entries.append(
            ScheduleEntry(
                subject_id=subject_id,
                day=problem.time_structure.days[day_idx],
                slot=slot,
                teacher_ids=subject.teacher_ids,
                group_ids=subject.group_ids,
                room_id=rooms_at.get((subject_id, day_idx, slot)),
            )
        )
    day_order = {day: i for i, day in enumerate(problem.time_structure.days)}
    entries.sort(key=lambda e: (day_order[e.day], e.slot, e.subject_id))
    return entries


def _solved_rooms(
    solver: cp_model.CpSolver, variables: SolverVariables
) -> dict[tuple[str, int, int], str]:
    """Map each scheduled (subject, day, slot) to its chosen room id."""
    chosen: dict[tuple[str, int, int], str] = {}
    for (subject_id, day_idx, slot, room_id), var in variables.room_choices.items():
        if solver.value(var):
            chosen[(subject_id, day_idx, slot)] = room_id
    return chosen


def _find_unresolved(schedule: list[ScheduleEntry], problem: TimetableProblem) -> list[str]:
    """Subject IDs scheduled for fewer hours than required."""
    scheduled: dict[str, int] = {}
    for entry in schedule:
        scheduled[entry.subject_id] = scheduled.get(entry.subject_id, 0) + 1
    return [s.id for s in problem.subjects if scheduled.get(s.id, 0) < s.hours_per_week]
