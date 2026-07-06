"""Independent schedule quality scoring - works on any schedule, not just solver output."""

from collections.abc import Callable
from dataclasses import dataclass, field

from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.schedule import ScheduleEntry
from timetable_solver.scoring import metrics, metrics_advanced, metrics_softened
from timetable_solver.scoring.violations import find_hard_violations

# metric name -> (SoftConstraints weight attribute, metric function).
# Advanced hard rules are covered by find_hard_violations (via
# violations_advanced); the M7.1 advanced soft rules and the M7.3 softened
# counterparts are priced below, so /score mirrors everything the CP-SAT
# objective optimizes. Every new weight defaults to 0, keeping scores for
# problems without advanced rules unchanged.
_METRICS: dict[str, tuple[str, Callable[..., metrics.MetricResult]]] = {
    "student_gaps": ("minimize_student_gaps", metrics.student_gaps),
    "teacher_gaps": ("minimize_teacher_gaps", metrics.teacher_gaps),
    "subject_spread": ("spread_subjects", metrics.subject_spread),
    "teacher_preferences": ("teacher_time_preferences", metrics.teacher_preferences),
    "compactness": ("compact_schedules", metrics.compactness),
    "workload_balance": ("workload_balance", metrics.workload_balance),
    "group_balance": ("group_workload_balance", metrics_advanced.group_balance),
    "lab_adjacency": ("avoid_consecutive_labs", metrics_advanced.lab_adjacency),
    "free_halfday": ("group_free_halfday", metrics_advanced.free_halfday),
    "room_stability": ("same_room", metrics_advanced.room_stability),
    "softened_breaks": ("soft_break", metrics_softened.softened_breaks),
    "softened_allowed_slots": ("soft_allowed_slots", metrics_softened.softened_allowed_slots),
    "softened_teacher_caps": ("soft_teacher_cap", metrics_softened.softened_teacher_caps),
    "softened_same_day": ("soft_same_day", metrics_softened.softened_same_day),
    "softened_orderings": ("soft_ordering", metrics_softened.softened_orderings),
}


@dataclass
class QualityReport:
    """Quality assessment of a schedule against its problem definition.

    Attributes:
        overall_score: 0-100 weighted summary (0.0 when hard constraints are violated).
        hard_violations: Violated hard constraints, human-readable (empty = valid).
        metrics: Per-metric scores, each 0-100.
        details: Per-metric human-readable issues.
    """

    overall_score: float
    hard_violations: list[str] = field(default_factory=list)
    metrics: dict[str, float] = field(default_factory=dict)
    details: dict[str, list[str]] = field(default_factory=dict)


def score_schedule(problem: TimetableProblem, schedule: list[ScheduleEntry]) -> QualityReport:
    """Score any schedule against the problem's constraints and preferences.

    Args:
        problem: The problem the schedule is meant to solve.
        schedule: Schedule entries from the solver, a file, or manual edits.

    Returns:
        QualityReport with overall score, per-metric breakdown, and violations.
        The overall score is the soft-weight-weighted average of metric scores
        (equal weights when no soft weights are configured) and drops to 0.0
        if any hard constraint is violated.
    """
    violations = find_hard_violations(problem, schedule)
    metric_scores: dict[str, float] = {}
    details: dict[str, list[str]] = {}
    for name, (_, metric_fn) in _METRICS.items():
        score, issues = metric_fn(problem, schedule)
        metric_scores[name] = round(score, 2)
        if issues:
            details[name] = issues
    overall = 0.0 if violations else _weighted_overall(problem, metric_scores)
    return QualityReport(
        overall_score=round(overall, 2),
        hard_violations=violations,
        metrics=metric_scores,
        details=details,
    )


def _weighted_overall(problem: TimetableProblem, scores: dict[str, float]) -> float:
    """Weighted average using configured soft weights, equal weights if none set."""
    soft = problem.constraints.soft
    weights = {
        name: getattr(soft, weight_attr)
        for name, (weight_attr, _) in _METRICS.items()
        if getattr(soft, weight_attr) > 0
    }
    if not weights:
        return sum(scores.values()) / len(scores)
    weighted = sum(scores[name] * weight for name, weight in weights.items())
    return weighted / sum(weights.values())
