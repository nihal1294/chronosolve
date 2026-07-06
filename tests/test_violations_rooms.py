"""Tests for the scorer's room eligibility checks (rules 19/24/25).

Mirror of solver.variables.compatible_rooms: required tags, reservations, and
opt-in capacity. Room *type* stays covered by violations._room_type_violations.
"""

from timetable_solver.models import (
    Room,
    ScheduleEntry,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)
from timetable_solver.scoring.violations_advanced import find_advanced_violations


def _room_problem(
    required_tags: set[str] | None = None,
    reservations: list[dict] | None = None,
    room_capacity: bool = False,
) -> TimetableProblem:
    """One subject (60 seats of demand), two rooms: big tagged r1, small bare r2."""
    return TimetableProblem(
        time_structure=TimeStructure(days=["Mon", "Tue"], slots_per_day=4),
        teachers=[Teacher(id="t1", name="A")],
        student_groups=[StudentGroup(id="g1", name="G", size=60)],
        subjects=[
            Subject(
                id="math",
                name="Math",
                hours_per_week=1,
                teacher_ids=["t1"],
                group_ids=["g1"],
                required_tags=required_tags or set(),
            )
        ],
        rooms=[
            Room(id="r1", name="Big", capacity=100, tags={"projector"}),
            Room(id="r2", name="Small", capacity=30),
        ],
        constraints={
            "hard": {"room_capacity": room_capacity},
            "advanced": {"room_reservations": reservations or []},
        },
    )


def _entry(room: str | None, slot: int = 1) -> ScheduleEntry:
    return ScheduleEntry(
        subject_id="math", day="Mon", slot=slot, teacher_ids=["t1"], group_ids=["g1"], room_id=room
    )


class TestRequiredTags:
    def test_flags_a_room_missing_a_required_tag(self) -> None:
        problem = _room_problem(required_tags={"projector"})
        violations = find_advanced_violations(problem, [_entry("r2")])
        assert len(violations) == 1
        assert "projector" in violations[0]

    def test_covering_room_passes(self) -> None:
        problem = _room_problem(required_tags={"projector"})
        assert find_advanced_violations(problem, [_entry("r1")]) == []


class TestReservations:
    def test_flags_a_subject_not_on_the_allow_list(self) -> None:
        problem = _room_problem(reservations=[{"room_id": "r1", "subject_ids": ["other"]}])
        violations = find_advanced_violations(problem, [_entry("r1")])
        assert len(violations) == 1
        assert "reserved" in violations[0]

    def test_allow_listed_subject_passes(self) -> None:
        problem = _room_problem(reservations=[{"room_id": "r1", "subject_ids": ["math"]}])
        assert find_advanced_violations(problem, [_entry("r1")]) == []


class TestCapacity:
    def test_flags_a_too_small_room_only_when_opted_in(self) -> None:
        needs_seats = [_entry("r2")]  # 60 seats of demand vs capacity 30
        assert find_advanced_violations(_room_problem(room_capacity=True), needs_seats) != []
        assert find_advanced_violations(_room_problem(room_capacity=False), needs_seats) == []


class TestEligibilityShape:
    def test_repeated_pairing_is_reported_once(self) -> None:
        problem = _room_problem(required_tags={"projector"})
        schedule = [_entry("r2", slot=1), _entry("r2", slot=2)]
        assert len(find_advanced_violations(problem, schedule)) == 1

    def test_roomless_entries_and_no_rooms_are_ignored(self) -> None:
        problem = _room_problem(required_tags={"projector"})
        assert find_advanced_violations(problem, [_entry(None)]) == []
