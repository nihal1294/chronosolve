"""Solver progress callback bridging CP-SAT to CLI and server consumers."""

from collections.abc import Callable
from dataclasses import dataclass

from ortools.sat.python import cp_model


@dataclass(frozen=True)
class ProgressEvent:
    """A progress snapshot emitted each time CP-SAT finds an improved solution.

    Attributes:
        objective: Current best objective value (0.0 when no soft constraints).
        wall_time_seconds: Elapsed solver wall time.
        solution_count: Number of incumbent solutions found so far.
    """

    objective: float
    wall_time_seconds: float
    solution_count: int


class ProgressCallback(cp_model.CpSolverSolutionCallback):
    """Invokes a plain-function callback on every incumbent solution."""

    def __init__(self, on_progress: Callable[[ProgressEvent], None]) -> None:
        super().__init__()
        self._on_progress = on_progress
        self._count = 0

    def on_solution_callback(self) -> None:
        """Called by CP-SAT from the search thread on each new solution."""
        self._count += 1
        self._on_progress(
            ProgressEvent(
                objective=self.objective_value,
                wall_time_seconds=self.wall_time,
                solution_count=self._count,
            )
        )
