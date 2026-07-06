"""Integration tests: advanced rules flow through find_hard_violations.

Two directions: hand-broken schedules are flagged through the single entry
point the annealer and /score use, and CP-SAT's own schedules never are
(solver-scorer agreement - a false-positive in the scorer mirror fails here).
"""

from timetable_solver import solve
from timetable_solver.models import (
    ScheduleEntry,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)
from timetable_solver.scoring.quality import score_schedule
from timetable_solver.scoring.violations import find_hard_violations

SOFTENED_METRIC_KEYS = [
    "group_balance",
    "lab_adjacency",
    "free_halfday",
    "room_stability",
    "softened_breaks",
    "softened_allowed_slots",
    "softened_teacher_caps",
    "softened_same_day",
    "softened_orderings",
]


def _advanced_problem() -> TimetableProblem:
    """Three 1-hour subjects with every softenable rule kind active and feasible.

    t1 teaches a+c with a 1h/day cap; a and b must avoid each other's day;
    c is limited to slots 1-2 and must run before b; Mon slot 4 is a break.
    (One valid layout: a Mon s1; c Tue s1; b Tue s2.)
    """
    return TimetableProblem(
        time_structure=TimeStructure(days=["Mon", "Tue"], slots_per_day=4),
        teachers=[Teacher(id="t1", name="A"), Teacher(id="t2", name="B")],
        student_groups=[StudentGroup(id="g1", name="G", size=30)],
        subjects=[
            Subject(id="a", name="A", hours_per_week=1, teacher_ids=["t1"], group_ids=["g1"]),
            Subject(id="b", name="B", hours_per_week=1, teacher_ids=["t2"], group_ids=["g1"]),
            Subject(
                id="c",
                name="C",
                hours_per_week=1,
                teacher_ids=["t1"],
                group_ids=["g1"],
                allowed_slots=[1, 2],
            ),
        ],
        constraints={
            "advanced": {
                "global_breaks": [{"day": "Mon", "slots": [4]}],
                "hard_teacher_daily_caps": {"t1": 1},
                "same_day_exclusions": [{"first": "a", "second": "b"}],
                "orderings": [{"first": "c", "second": "b"}],
            }
        },
    )


def test_advanced_violations_surface_through_find_hard_violations() -> None:
    problem = _advanced_problem()
    inside_break = [
        ScheduleEntry(subject_id="a", day="Mon", slot=4, teacher_ids=["t1"], group_ids=["g1"])
    ]
    assert any("break" in v for v in find_hard_violations(problem, inside_break))


def test_cpsat_schedules_pass_the_advanced_checks() -> None:
    result = solve(_advanced_problem(), time_limit=10)
    assert result.status in ("optimal", "feasible")
    assert find_hard_violations(_advanced_problem(), result.schedule) == []


def _softened_break_problem(weight: int) -> TimetableProblem:
    """One subject, one softened Mon-slot-2 break, soft_break at the given weight."""
    return TimetableProblem(
        time_structure=TimeStructure(days=["Mon", "Tue"], slots_per_day=4),
        teachers=[Teacher(id="t1", name="A")],
        student_groups=[StudentGroup(id="g1", name="G", size=30)],
        subjects=[
            Subject(id="math", name="Math", hours_per_week=1, teacher_ids=["t1"], group_ids=["g1"])
        ],
        constraints={
            "soft": {"soft_break": weight},
            "advanced": {
                "global_breaks": [{"day": "Mon", "slots": [2]}],
                "softened": [{"kind": "break", "key": "0"}],
            },
        },
    )


def test_a_violated_softened_preference_moves_the_score() -> None:
    # The M7.3 dishonesty this milestone fixes: a schedule breaking the very
    # preference the user paid a weight for must not score as if it honored it.
    in_break = [
        ScheduleEntry(subject_id="math", day="Mon", slot=2, teacher_ids=["t1"], group_ids=["g1"])
    ]
    weighted = score_schedule(_softened_break_problem(50), in_break)
    assert weighted.hard_violations == []  # softened: not a hard failure
    assert weighted.metrics["softened_breaks"] == 0.0  # the window's only slot is taken
    assert weighted.details["softened_breaks"]
    unweighted = score_schedule(_softened_break_problem(0), in_break)
    assert weighted.overall_score < unweighted.overall_score


def test_an_unsoftened_advanced_violation_zeroes_the_score() -> None:
    problem = _advanced_problem()
    inside_break = [
        ScheduleEntry(subject_id="a", day="Mon", slot=4, teacher_ids=["t1"], group_ids=["g1"])
    ]
    report = score_schedule(problem, inside_break)
    assert report.overall_score == 0.0
    assert report.hard_violations


def test_problems_without_advanced_rules_keep_perfect_scores() -> None:
    # A schedule that is perfect on every base metric must stay a 100 - the 9
    # new metrics are vacuously perfect and weightless, never a drag. (With any
    # weight configured they are excluded from the average until softening or a
    # rule sets theirs; only the all-zero-weights equal-average fallback sees
    # their vacuous 100s at all.)
    problem = TimetableProblem(
        time_structure=TimeStructure(days=["Mon", "Tue"], slots_per_day=4),
        teachers=[Teacher(id="t1", name="A")],
        student_groups=[StudentGroup(id="g1", name="G", size=30)],
        subjects=[
            Subject(id="math", name="Math", hours_per_week=2, teacher_ids=["t1"], group_ids=["g1"])
        ],
    )
    schedule = [
        ScheduleEntry(subject_id="math", day="Mon", slot=1, teacher_ids=["t1"], group_ids=["g1"]),
        ScheduleEntry(subject_id="math", day="Tue", slot=1, teacher_ids=["t1"], group_ids=["g1"]),
    ]
    report = score_schedule(problem, schedule)
    for key in SOFTENED_METRIC_KEYS:
        assert report.metrics[key] == 100.0  # present, perfect, and weightless
    assert report.overall_score == 100.0
