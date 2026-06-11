"""Statistics computation tests against hand-calculated values."""

from timetable_solver.models import (
    Room,
    ScheduleEntry,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)
from timetable_solver.scoring import compute_statistics


def _problem() -> TimetableProblem:
    return TimetableProblem(
        time_structure=TimeStructure(days=["Mon", "Tue"], slots_per_day=4),
        teachers=[Teacher(id="t1", name="T1"), Teacher(id="t2", name="T2")],
        student_groups=[StudentGroup(id="g1", name="G", size=20)],
        subjects=[
            Subject(
                id="s1",
                name="S1",
                hours_per_week=3,
                max_per_day=2,
                teacher_ids=["t1"],
                group_ids=["g1"],
            ),
            Subject(id="s2", name="S2", hours_per_week=1, teacher_ids=["t2"], group_ids=["g1"]),
        ],
        rooms=[Room(id="r1", name="R1", capacity=30)],
    )


def _schedule() -> list[ScheduleEntry]:
    """t1: Mon slots 1,3 (one gap), Tue slot 1. t2: Mon slot 2. All in r1."""
    return [
        ScheduleEntry(
            subject_id="s1", day="Mon", slot=1, teacher_ids=["t1"], group_ids=["g1"], room_id="r1"
        ),
        ScheduleEntry(
            subject_id="s2", day="Mon", slot=2, teacher_ids=["t2"], group_ids=["g1"], room_id="r1"
        ),
        ScheduleEntry(
            subject_id="s1", day="Mon", slot=3, teacher_ids=["t1"], group_ids=["g1"], room_id="r1"
        ),
        ScheduleEntry(
            subject_id="s1", day="Tue", slot=1, teacher_ids=["t1"], group_ids=["g1"], room_id="r1"
        ),
    ]


class TestStatistics:
    def test_hand_computed_values(self) -> None:
        stats = compute_statistics(_problem(), _schedule())
        assert stats.teacher_hours == {"t1": 3, "t2": 1}
        assert stats.group_hours == {"g1": 4}
        # r1 occupied 4 of 8 weekly slots
        assert stats.room_utilization == {"r1": 0.5}
        assert stats.busiest_day == "Mon"
        # g1: Mon slots [1,2,3] gap 0, Tue [1] gap 0 -> avg 0
        assert stats.avg_student_gap == 0.0
        # t1: Mon [1,3] gap 1, Tue [1] gap 0; t2: Mon [2] gap 0 -> 1/3
        assert stats.avg_teacher_gap == round(1 / 3, 4)

    def test_empty_schedule(self) -> None:
        stats = compute_statistics(_problem(), [])
        assert stats.teacher_hours == {}
        assert stats.busiest_day == ""
        assert stats.avg_student_gap == 0.0
        assert stats.room_utilization == {"r1": 0.0}
