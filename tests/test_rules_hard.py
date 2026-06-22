"""Tests for M7 hard rule generators (room rules + advanced hard constraints).

Each test builds a small problem where the rule changes the outcome, solves, and
asserts the rule held. The control for "the generator does something" is that
reverting the generator body makes the matching assertion fail.
"""

from collections import Counter

from timetable_solver import solve
from timetable_solver.models import (
    AdvancedConstraints,
    ConstraintsConfig,
    GlobalBreak,
    HardConstraints,
    Room,
    RoomReservation,
    StudentGroup,
    Subject,
    SubjectPair,
    Teacher,
    TimeStructure,
    TimetableProblem,
)


def _room(spec: dict) -> Room:
    return Room(
        id=spec["id"],
        name=spec.get("name", spec["id"]),
        capacity=spec.get("capacity", 30),
        type=spec.get("type", "any"),
        tags=spec.get("tags", set()),
    )


def _one_subject_two_rooms(
    *,
    room_a: dict,
    room_b: dict,
    subject_extra: dict | None = None,
    group_size: int = 30,
    hard: dict | None = None,
    advanced: dict | None = None,
) -> TimetableProblem:
    """A 1-subject, 2-room problem for exercising room rules in isolation."""
    constraints = ConstraintsConfig(
        hard=HardConstraints(**(hard or {})),
        advanced=AdvancedConstraints(**(advanced or {})),
    )
    return TimetableProblem(
        time_structure=TimeStructure(days=["Monday", "Tuesday"], slots_per_day=4),
        teachers=[Teacher(id="t1", name="T One")],
        student_groups=[StudentGroup(id="g1", name="Section A", size=group_size)],
        subjects=[
            Subject(
                id="mine",
                name="Mine",
                hours_per_week=2,
                teacher_ids=["t1"],
                group_ids=["g1"],
                **(subject_extra or {}),
            )
        ],
        rooms=[_room(room_a), _room(room_b)],
        constraints=constraints,
    )


def _advanced_problem(
    *,
    subjects: list[Subject],
    days: list[str] | None = None,
    slots: int = 4,
    groups: list[StudentGroup] | None = None,
    teachers: list[Teacher] | None = None,
    advanced: dict | None = None,
    hard: dict | None = None,
) -> TimetableProblem:
    """A roomless problem for exercising advanced hard rules in isolation."""
    time_structure = TimeStructure(
        days=days or ["Monday", "Tuesday", "Wednesday"], slots_per_day=slots
    )
    return TimetableProblem(
        time_structure=time_structure,
        teachers=teachers or [Teacher(id="t1", name="T One")],
        student_groups=groups or [StudentGroup(id="g1", name="G One", size=30)],
        subjects=subjects,
        constraints=ConstraintsConfig(
            hard=HardConstraints(**(hard or {})),
            advanced=AdvancedConstraints(**(advanced or {})),
        ),
    )


def _subject(sid: str, hours: int = 3, **extra: object) -> Subject:
    return Subject(
        id=sid,
        name=sid.upper(),
        hours_per_week=hours,
        teacher_ids=["t1"],
        group_ids=["g1"],
        **extra,
    )


class TestRoomRules:
    def test_required_tags_force_a_tagged_room(self) -> None:
        problem = _one_subject_two_rooms(
            room_a={"id": "plain", "tags": set()},
            room_b={"id": "gpu", "tags": {"gpu"}},
            subject_extra={"required_tags": {"gpu"}},
        )
        result = solve(problem, time_limit=10)
        assert result.status in ("optimal", "feasible")
        assert result.schedule
        assert all(e.room_id == "gpu" for e in result.schedule)

    def test_capacity_flag_excludes_too_small_rooms(self) -> None:
        problem = _one_subject_two_rooms(
            room_a={"id": "small", "capacity": 5},
            room_b={"id": "big", "capacity": 50},
            group_size=40,
            hard={"room_capacity": True},
        )
        result = solve(problem, time_limit=10)
        assert result.status in ("optimal", "feasible")
        assert result.schedule
        assert all(e.room_id == "big" for e in result.schedule)

    def test_capacity_off_allows_small_room(self) -> None:
        # Without the flag, capacity is not a hard filter: a feasible solve exists
        # even though every room is smaller than the group.
        problem = _one_subject_two_rooms(
            room_a={"id": "small", "capacity": 5},
            room_b={"id": "alsosmall", "capacity": 6},
            group_size=40,
        )
        result = solve(problem, time_limit=10)
        assert result.status in ("optimal", "feasible")

    def test_reservation_excludes_other_subjects(self) -> None:
        problem = _one_subject_two_rooms(
            room_a={"id": "reserved"},
            room_b={"id": "open"},
            advanced={
                "room_reservations": [
                    RoomReservation(room_id="reserved", subject_ids=["someone_else"])
                ]
            },
        )
        result = solve(problem, time_limit=10)
        assert result.status in ("optimal", "feasible")
        assert result.schedule
        assert all(e.room_id == "open" for e in result.schedule)


class TestGlobalBreaks:
    def test_break_clears_that_slot(self) -> None:
        problem = _advanced_problem(
            subjects=[_subject("math", hours=3)],
            advanced={"global_breaks": [GlobalBreak(day="Monday", slots=[1])]},
        )
        result = solve(problem, time_limit=10)
        assert result.status in ("optimal", "feasible")
        assert not any(e.day == "Monday" and e.slot == 1 for e in result.schedule)

    def test_over_constrained_break_is_named(self) -> None:
        # Monday has 4 slots; blocking 2 leaves room for only 2 of the 4 required
        # hours -> infeasible, and the cause is the break (not a structural rule).
        problem = _advanced_problem(
            subjects=[_subject("math", hours=4, max_per_day=4)],
            days=["Monday"],
            slots=4,
            advanced={"global_breaks": [GlobalBreak(day="Monday", slots=[1, 2])]},
        )
        result = solve(problem, time_limit=10)
        assert result.status == "infeasible"
        assert any("break" in r.lower() for r in result.unresolved)


class TestAllowedSlots:
    def test_subject_confined_to_its_slots(self) -> None:
        # allowed_slots=[3] with one session per day forces every entry onto slot 3.
        problem = _advanced_problem(
            subjects=[_subject("lab", hours=2, allowed_slots=[3], max_per_day=1)],
            days=["Monday", "Tuesday"],
            slots=4,
        )
        result = solve(problem, time_limit=10)
        assert result.status in ("optimal", "feasible")
        assert result.schedule
        assert all(e.slot == 3 for e in result.schedule)

    def test_allowed_slots_too_tight_is_infeasible(self) -> None:
        # Only slot 1 allowed on the single day, but 2 hours are needed -> infeasible.
        problem = _advanced_problem(
            subjects=[_subject("lab", hours=2, allowed_slots=[1], max_per_day=2)],
            days=["Monday"],
            slots=6,
        )
        result = solve(problem, time_limit=10)
        assert result.status == "infeasible"


class TestHardTeacherCaps:
    def test_cap_spreads_hours_across_days(self) -> None:
        # 4 hours, cap 2/day, two days -> the only feasible split is 2 + 2.
        problem = _advanced_problem(
            subjects=[_subject("math", hours=4, max_per_day=4)],
            days=["Monday", "Tuesday"],
            slots=6,
            advanced={"hard_teacher_daily_caps": {"t1": 2}},
        )
        result = solve(problem, time_limit=10)
        assert result.status in ("optimal", "feasible")
        per_day = Counter(e.day for e in result.schedule if "t1" in e.teacher_ids)
        assert per_day and all(count <= 2 for count in per_day.values())

    def test_cap_too_tight_for_one_day_is_infeasible(self) -> None:
        # Only Monday exists; 4 hours needed but capped at 2/day -> infeasible.
        problem = _advanced_problem(
            subjects=[_subject("math", hours=4, max_per_day=4)],
            days=["Monday"],
            slots=6,
            advanced={"hard_teacher_daily_caps": {"t1": 2}},
        )
        result = solve(problem, time_limit=10)
        assert result.status == "infeasible"


class TestSameDayExclusion:
    def test_pair_never_shares_a_day(self) -> None:
        problem = _advanced_problem(
            subjects=[_subject("a", hours=2, max_per_day=2), _subject("b", hours=2, max_per_day=2)],
            days=["Monday", "Tuesday"],
            slots=6,
            advanced={"same_day_exclusions": [SubjectPair(first="a", second="b")]},
        )
        result = solve(problem, time_limit=10)
        assert result.status in ("optimal", "feasible")
        days_a = {e.day for e in result.schedule if e.subject_id == "a"}
        days_b = {e.day for e in result.schedule if e.subject_id == "b"}
        assert days_a and days_b
        assert not (days_a & days_b)

    def test_exclusion_on_only_day_is_infeasible(self) -> None:
        # Both subjects must run on the single day, but cannot share it -> infeasible.
        problem = _advanced_problem(
            subjects=[_subject("a", hours=1), _subject("b", hours=1)],
            days=["Monday"],
            slots=6,
            advanced={"same_day_exclusions": [SubjectPair(first="a", second="b")]},
        )
        result = solve(problem, time_limit=10)
        assert result.status == "infeasible"


def _earliest_index(schedule: list, subject_id: str, days: list[str]) -> int:
    day_order = {d: i for i, d in enumerate(days)}
    return min(day_order[e.day] * 100 + e.slot for e in schedule if e.subject_id == subject_id)


class TestOrdering:
    def test_a_runs_before_b(self) -> None:
        days = ["Monday", "Tuesday"]
        problem = _advanced_problem(
            subjects=[_subject("a", hours=1), _subject("b", hours=1)],
            days=days,
            slots=4,
            advanced={"orderings": [SubjectPair(first="a", second="b")]},
        )
        result = solve(problem, time_limit=10)
        assert result.status in ("optimal", "feasible")
        first_a = _earliest_index(result.schedule, "a", days)
        first_b = _earliest_index(result.schedule, "b", days)
        assert first_a < first_b

    def test_ordering_against_fixed_slots_is_infeasible(self) -> None:
        # b is pinned before a (allowed_slots), but the ordering demands a before b.
        problem = _advanced_problem(
            subjects=[
                _subject("a", hours=1, allowed_slots=[3]),
                _subject("b", hours=1, allowed_slots=[1]),
            ],
            days=["Monday"],
            slots=4,
            advanced={"orderings": [SubjectPair(first="a", second="b")]},
        )
        result = solve(problem, time_limit=10)
        assert result.status == "infeasible"
