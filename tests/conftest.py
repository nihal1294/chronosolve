"""Shared test fixtures for timetable solver tests."""

from pathlib import Path

import pytest

from timetable_solver.models import (
    Room,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures_dir() -> Path:
    """Path to the test fixtures directory."""
    return FIXTURES_DIR


@pytest.fixture
def minimal_time_structure() -> TimeStructure:
    """A simple 3-day, 4-slot time structure."""
    return TimeStructure(
        days=["Monday", "Tuesday", "Wednesday"],
        slots_per_day=4,
    )


@pytest.fixture
def minimal_problem(minimal_time_structure: TimeStructure) -> TimetableProblem:
    """Simplest valid problem: 1 teacher, 1 group, 1 subject."""
    return TimetableProblem(
        time_structure=minimal_time_structure,
        teachers=[Teacher(id="t1", name="Dr. Smith")],
        student_groups=[StudentGroup(id="g1", name="Section A", size=30)],
        subjects=[
            Subject(
                id="math101",
                name="Mathematics I",
                hours_per_week=3,
                teacher_ids=["t1"],
                group_ids=["g1"],
            )
        ],
    )


@pytest.fixture
def problem_with_rooms(minimal_time_structure: TimeStructure) -> TimetableProblem:
    """Problem including rooms and room type preferences."""
    return TimetableProblem(
        time_structure=minimal_time_structure,
        teachers=[
            Teacher(id="t1", name="Dr. Smith"),
            Teacher(id="t2", name="Dr. Jones"),
        ],
        student_groups=[StudentGroup(id="g1", name="Section A", size=30)],
        subjects=[
            Subject(
                id="math",
                name="Mathematics",
                hours_per_week=3,
                teacher_ids=["t1"],
                group_ids=["g1"],
                preferred_room_type="lecture",
            ),
            Subject(
                id="lab1",
                name="CS Lab",
                hours_per_week=2,
                type="lab",
                teacher_ids=["t2"],
                group_ids=["g1"],
                consecutive_hours=2,
                preferred_room_type="lab",
            ),
        ],
        rooms=[
            Room(id="r1", name="Room 101", capacity=50, type="lecture"),
            Room(id="r2", name="Lab 1", capacity=30, type="lab"),
        ],
    )
