"""Solver orchestrator - build model, add constraints, solve, extract."""

import os
from collections.abc import Callable

from ortools.sat.python import cp_model

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import SolveResult
from timetable_solver.scoring.quality import score_schedule
from timetable_solver.solver.annealing import anneal
from timetable_solver.solver.callback import ProgressCallback, ProgressEvent
from timetable_solver.solver.extractor import extract_solution
from timetable_solver.solver.hard import (
    add_availability,
    add_consecutive_blocks,
    add_group_max_hours,
    add_group_no_clash,
    add_max_per_day,
    add_pre_assignments,
    add_required_hours,
    add_teacher_no_clash,
)
from timetable_solver.solver.rooms import add_room_constraints
from timetable_solver.solver.soft import add_soft_objectives
from timetable_solver.solver.variables import create_variables

_HARD_CONSTRAINT_BUILDERS = (
    add_required_hours,
    add_teacher_no_clash,
    add_group_no_clash,
    add_availability,
    add_consecutive_blocks,
    add_max_per_day,
    add_group_max_hours,
    add_room_constraints,
    add_pre_assignments,
)


def solve(
    problem: TimetableProblem,
    time_limit: int = 60,
    on_progress: Callable[[ProgressEvent], None] | None = None,
    refine: bool = False,
    cancel_check: Callable[[], bool] | None = None,
) -> SolveResult:
    """Solve a timetable problem using CP-SAT.

    Args:
        problem: Validated timetable problem.
        time_limit: Maximum solver wall time in seconds.
        on_progress: Optional callback invoked on each improved solution.
        refine: Run simulated annealing on the CP-SAT solution afterwards.
        cancel_check: Optional predicate polled on each incumbent solution;
            when it returns True the search stops cooperatively (used by the
            streaming server to abort a solve once its client disconnects).

    Returns:
        SolveResult with status, schedule entries, and solve metadata.

    Raises:
        SolverError: If CP-SAT rejects the generated model (internal bug).
    """
    model = cp_model.CpModel()
    variables = create_variables(model, problem)
    for build in _HARD_CONSTRAINT_BUILDERS:
        build(model, variables, problem)
    add_soft_objectives(model, variables, problem)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(time_limit)
    solver.parameters.num_workers = os.cpu_count() or 8

    needs_callback = on_progress is not None or cancel_check is not None
    progress = ProgressCallback(on_progress, cancel_check) if needs_callback else None
    status = solver.solve(model, progress)
    result = extract_solution(solver, status, variables, problem)
    if result.schedule:
        result.quality_score = score_schedule(problem, result.schedule).overall_score
        if refine:
            result = anneal(problem, result)
    return result
