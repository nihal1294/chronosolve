"""Composition test: many M7 rules active at once still solve and are respected.

Guards that the new hard generators, soft penalties, and room filtering compose
with the core hard constraints without conflict or regression.
"""

from tests.verify import assert_hard_constraints
from timetable_solver import solve
from timetable_solver.models import (
    AdvancedConstraints,
    ConstraintsConfig,
    GlobalBreak,
    HardConstraints,
    Room,
    SoftConstraints,
    StudentGroup,
    Subject,
    SubjectPair,
    Teacher,
    TimeStructure,
    TimetableProblem,
)


def _combined_problem() -> TimetableProblem:
    subjects = [
        Subject(
            id="lecture",
            name="Lecture",
            hours_per_week=3,
            max_per_day=2,
            teacher_ids=["t1"],
            group_ids=["g1"],
        ),
        Subject(
            id="lab",
            name="Lab",
            hours_per_week=2,
            max_per_day=2,
            type="lab",
            teacher_ids=["t2"],
            group_ids=["g1"],
        ),
        Subject(
            id="seminar",
            name="Seminar",
            hours_per_week=2,
            max_per_day=2,
            teacher_ids=["t1"],
            group_ids=["g1"],
        ),
    ]
    advanced = AdvancedConstraints(
        global_breaks=[GlobalBreak(day="Wednesday", slots=[6])],
        same_day_exclusions=[SubjectPair(first="lecture", second="lab")],
        orderings=[SubjectPair(first="seminar", second="lab")],
        hard_teacher_daily_caps={"t1": 3},
    )
    return TimetableProblem(
        time_structure=TimeStructure(days=["Monday", "Tuesday", "Wednesday"], slots_per_day=6),
        teachers=[Teacher(id="t1", name="T1"), Teacher(id="t2", name="T2")],
        student_groups=[StudentGroup(id="g1", name="G1", size=30)],
        subjects=subjects,
        rooms=[
            Room(id="r1", name="R1", capacity=40),
            Room(id="r2", name="R2", capacity=40, type="lab"),
        ],
        constraints=ConstraintsConfig(
            hard=HardConstraints(room_capacity=True),
            soft=SoftConstraints(group_workload_balance=20, same_room=20),
            advanced=advanced,
        ),
    )


def _earliest(schedule: list, subject_id: str, days: list[str]) -> int:
    order = {d: i for i, d in enumerate(days)}
    return min(order[e.day] * 100 + e.slot for e in schedule if e.subject_id == subject_id)


def test_many_rules_compose_and_are_respected() -> None:
    problem = _combined_problem()
    result = solve(problem, time_limit=30)
    assert result.status in ("optimal", "feasible")
    assert result.unresolved == []

    # Core hard constraints still hold (no regression from the new builders).
    assert_hard_constraints(problem, result.schedule)

    # Global break: nothing on Wednesday slot 6.
    assert not any(e.day == "Wednesday" and e.slot == 6 for e in result.schedule)

    # Same-day exclusion: lecture and lab never share a day.
    lecture_days = {e.day for e in result.schedule if e.subject_id == "lecture"}
    lab_days = {e.day for e in result.schedule if e.subject_id == "lab"}
    assert not (lecture_days & lab_days)

    # Ordering: seminar's first session precedes lab's.
    days = problem.time_structure.days
    assert _earliest(result.schedule, "seminar", days) < _earliest(result.schedule, "lab", days)
