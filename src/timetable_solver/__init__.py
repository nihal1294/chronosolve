"""ChronoSolve - generalized university timetable scheduling solver.

Public API:
    load_problem: Load a timetable problem from YAML/JSON file.
    load_problem_from_dict: Load from a raw dict (for API usage).
    validate_problem: Pre-solve validation returning errors and warnings.
    solve: Solve a problem with CP-SAT and return a SolveResult.
    score_schedule: Independently score any schedule's quality.
"""

from timetable_solver.io.loader import load_problem, load_problem_from_dict
from timetable_solver.scoring import score_schedule
from timetable_solver.solver import solve
from timetable_solver.validation.validator import validate_problem

__all__ = [
    "load_problem",
    "load_problem_from_dict",
    "score_schedule",
    "solve",
    "validate_problem",
]
