"""CP-SAT constraint solver for timetable problems."""

from timetable_solver.solver.annealing import anneal
from timetable_solver.solver.callback import ProgressEvent
from timetable_solver.solver.cpsat_solver import solve
from timetable_solver.solver.extractor import SolverError

__all__ = ["ProgressEvent", "SolverError", "anneal", "solve"]
