"""Simulated annealing refinement — local search on top of a CP-SAT solution.

Moves single-hour entries between slots, accepting changes per the Metropolis
criterion on the independent quality score. Consecutive-block subjects and
pre-assigned entries are never moved, and any move that would violate a hard
constraint is rejected outright, so the result is always at least as good and
always valid.
"""

import math
import random

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import ScheduleEntry, SolveResult
from timetable_solver.scoring.quality import score_schedule
from timetable_solver.scoring.violations import find_hard_violations

_INITIAL_TEMPERATURE = 5.0
_COOLING_RATE = 0.97
_STALL_LIMIT = 300


def anneal(
    problem: TimetableProblem,
    result: SolveResult,
    max_iterations: int = 2000,
    seed: int | None = None,
) -> SolveResult:
    """Refine a feasible solve result with simulated annealing.

    Args:
        problem: The problem the result solves.
        result: A feasible/optimal solve result to refine.
        max_iterations: Iteration budget.
        seed: Random seed for reproducible refinement.

    Returns:
        A SolveResult with the best schedule found (never worse than the input).
    """
    if not result.schedule:
        return result
    rng = random.Random(seed)
    movable = _movable_indices(problem, result.schedule)
    if not movable:
        return result

    current = [entry.model_copy() for entry in result.schedule]
    current_score = score_schedule(problem, current).overall_score
    best, best_score = [e.model_copy() for e in current], current_score
    temperature = _INITIAL_TEMPERATURE
    stalled = 0

    for _ in range(max_iterations):
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

    return result.model_copy(
        update={"schedule": best, "quality_score": round(best_score, 2)}
    )


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
