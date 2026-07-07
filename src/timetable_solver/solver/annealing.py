"""Simulated annealing refinement - local search on top of a CP-SAT solution.

Moves single-hour entries between slots, accepting changes per the Metropolis
criterion on the independent quality score. Consecutive-block subjects and
pre-assigned entries are never moved, and any move that would violate a hard
constraint is rejected outright, so the result is always at least as good and
always valid.
"""

import math
import random
from collections.abc import Callable
from dataclasses import dataclass

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import ScheduleEntry, SolveResult
from timetable_solver.scoring.quality import score_schedule
from timetable_solver.scoring.violations import find_hard_violations

_INITIAL_TEMPERATURE = 5.0
_COOLING_RATE = 0.97
_STALL_LIMIT = 300


@dataclass
class RefineHooks:
    """Optional annealing instrumentation; every default is a no-op.

    Attributes:
        on_progress: Called every `progress_every` iterations with
            (iteration, best_score) - the /solve/stream polishing phase.
        should_stop: Checked each iteration; True ends refinement early
            (wired to client disconnect by the stream endpoint).
        progress_every: Iterations between on_progress calls.
    """

    on_progress: Callable[[int, float], None] | None = None
    should_stop: Callable[[], bool] | None = None
    progress_every: int = 100


def anneal(
    problem: TimetableProblem,
    result: SolveResult,
    max_iterations: int = 2000,
    seed: int | None = None,
    hooks: RefineHooks | None = None,
) -> SolveResult:
    """Refine a feasible solve result with simulated annealing.

    Args:
        problem: The problem the result solves.
        result: A feasible/optimal solve result to refine.
        max_iterations: Iteration budget.
        seed: Random seed for reproducible refinement.
        hooks: Optional progress/cancellation instrumentation.

    Returns:
        A SolveResult with the best schedule found (never worse than the input).
    """
    if not result.schedule:
        return result
    rng = random.Random(seed)
    movable = _movable_indices(problem, result.schedule)
    if not movable:
        return result

    hooks = hooks or RefineHooks()
    current = [entry.model_copy() for entry in result.schedule]
    current_score = score_schedule(problem, current).overall_score
    best, best_score = [e.model_copy() for e in current], current_score
    temperature = _INITIAL_TEMPERATURE
    stalled = 0

    for iteration in range(max_iterations):
        if hooks.should_stop is not None and hooks.should_stop():
            break
        # Emit before the stall/perfect breaks so a refine run always shows at
        # least one polishing event, even when there is nothing left to improve.
        if hooks.on_progress is not None and iteration % hooks.progress_every == 0:
            hooks.on_progress(iteration, best_score)
        if stalled >= _STALL_LIMIT or best_score >= 100.0:
            break
        candidate = _random_neighbor(problem, current, movable, rng)
        stalled += 1
        if candidate is None or find_hard_violations(problem, candidate):
            continue
        candidate_score = score_schedule(problem, candidate).overall_score
        if _accept(candidate_score - current_score, temperature, rng):
            current, current_score = candidate, candidate_score
            if current_score > best_score:
                best = [e.model_copy() for e in current]
                best_score = current_score
                stalled = 0
        temperature *= _COOLING_RATE

    return result.model_copy(update={"schedule": best, "quality_score": round(best_score, 2)})


def _movable_indices(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> list[int]:
    """Indices of entries that local moves may relocate.

    Block subjects (consecutive_hours > 1) and pre-assigned slots stay fixed.
    """
    block_subjects = {s.id for s in problem.subjects if (s.consecutive_hours or 1) > 1}
    pinned = {(pa.subject_id, pa.day, pa.slot) for pa in problem.pre_assignments}
    return [
        i
        for i, entry in enumerate(schedule)
        if entry.subject_id not in block_subjects
        and (entry.subject_id, entry.day, entry.slot) not in pinned
    ]


def _random_neighbor(
    problem: TimetableProblem,
    schedule: list[ScheduleEntry],
    movable: list[int],
    rng: random.Random,
) -> list[ScheduleEntry] | None:
    """Produce a neighboring schedule via a random move or swap."""
    candidate = [entry.model_copy() for entry in schedule]
    if len(movable) >= 2 and rng.random() < 0.5:
        first, second = rng.sample(movable, 2)
        a, b = candidate[first], candidate[second]
        a.day, b.day = b.day, a.day
        a.slot, b.slot = b.slot, a.slot
        return candidate
    target = candidate[rng.choice(movable)]
    day = rng.choice(problem.time_structure.days)
    slot = rng.randint(1, problem.time_structure.get_slots_for_day(day))
    if (day, slot) == (target.day, target.slot):
        return None
    target.day, target.slot = day, slot
    return candidate


def _accept(delta: float, temperature: float, rng: random.Random) -> bool:
    """Metropolis criterion: always accept improvements, sometimes accept losses."""
    if delta >= 0:
        return True
    if temperature <= 0:
        return False
    return rng.random() < math.exp(delta / temperature)
