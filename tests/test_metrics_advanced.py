"""Tests for scoring/metrics_advanced - the 4 M7.1 advanced soft rules.

Directional contract per metric: violating schedule < 100 with a detail,
honoring schedule == 100, nothing configured == 100.
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
from timetable_solver.scoring.grid import daily_balance_ratio
from timetable_solver.scoring.metrics_advanced import (
    free_halfday,
    group_balance,
    lab_adjacency,
    room_stability,
)

DAYS = ["Mon", "Tue", "Wed"]


def _problem(
    subject_kind: str = "theory",
    advanced: dict | None = None,
    rooms: list[Room] | None = None,
) -> TimetableProblem:
    """One group, one subject (3h) on a 3-day x 4-slot grid."""
    return TimetableProblem(
        time_structure=TimeStructure(days=DAYS, slots_per_day=4),
        teachers=[Teacher(id="t1", name="A")],
        student_groups=[StudentGroup(id="g1", name="G", size=30)],
        subjects=[
            Subject(
                id="math",
                name="Math",
                hours_per_week=3,
                teacher_ids=["t1"],
                group_ids=["g1"],
                type=subject_kind,
            )
        ],
        rooms=rooms or [],
        constraints={"advanced": advanced or {}},
    )


def _entry(day: str, slot: int, room: str | None = None) -> ScheduleEntry:
    return ScheduleEntry(
        subject_id="math", day=day, slot=slot, teacher_ids=["t1"], group_ids=["g1"], room_id=room
    )


def test_daily_balance_ratio_contract() -> None:
    assert daily_balance_ratio({"Mon": 1, "Tue": 1, "Wed": 1}, DAYS) == 0.0
    lopsided = daily_balance_ratio({"Mon": 3}, DAYS)
    assert lopsided is not None and lopsided > 0.0
    assert daily_balance_ratio({}, DAYS) is None  # nothing to balance
    assert daily_balance_ratio({"Mon": 2}, ["Mon"]) is None  # single day


class TestGroupBalance:
    def test_lopsided_group_scores_below_100(self) -> None:
        score, details = group_balance(
            _problem(), [_entry("Mon", 1), _entry("Mon", 2), _entry("Mon", 3)]
        )
        assert score < 100.0
        assert details  # names the uneven group

    def test_even_spread_scores_100(self) -> None:
        score, _ = group_balance(_problem(), [_entry("Mon", 1), _entry("Tue", 1), _entry("Wed", 1)])
        assert score == 100.0

    def test_unscheduled_group_scores_100(self) -> None:
        assert group_balance(_problem(), [])[0] == 100.0


class TestLabAdjacency:
    def test_adjacent_lab_hours_score_below_100(self) -> None:
        score, details = lab_adjacency(_problem("lab"), [_entry("Mon", 1), _entry("Mon", 2)])
        assert score < 100.0
        assert details

    def test_separated_lab_hours_score_100(self) -> None:
        score, _ = lab_adjacency(_problem("lab"), [_entry("Mon", 1), _entry("Mon", 3)])
        assert score == 100.0

    def test_theory_subjects_are_ignored(self) -> None:
        assert lab_adjacency(_problem(), [_entry("Mon", 1), _entry("Mon", 2)])[0] == 100.0


class TestFreeHalfday:
    REQUEST = {"group_free_halfdays": [{"group_id": "g1", "day": "Mon", "half": "morning"}]}

    def test_class_in_the_requested_half_scores_below_100(self) -> None:
        score, details = free_halfday(_problem(advanced=self.REQUEST), [_entry("Mon", 1)])
        assert score < 100.0
        assert details

    def test_free_half_scores_100(self) -> None:
        # Slot 3 is the afternoon of a 4-slot day; the morning stays free.
        score, _ = free_halfday(_problem(advanced=self.REQUEST), [_entry("Mon", 3)])
        assert score == 100.0

    def test_no_requests_scores_100(self) -> None:
        assert free_halfday(_problem(), [_entry("Mon", 1)])[0] == 100.0

    def test_unknown_day_request_is_skipped(self) -> None:
        bad = {"group_free_halfdays": [{"group_id": "g1", "day": "Sun", "half": "morning"}]}
        assert free_halfday(_problem(advanced=bad), [_entry("Mon", 1)])[0] == 100.0


class TestRoomStability:
    ROOMS = [Room(id="r1", name="R1", capacity=40), Room(id="r2", name="R2", capacity=40)]
    LISTED = {"same_room_subjects": ["math"]}

    def test_room_hopping_scores_below_100(self) -> None:
        schedule = [_entry("Mon", 1, "r1"), _entry("Tue", 1, "r2")]
        score, details = room_stability(_problem(advanced=self.LISTED, rooms=self.ROOMS), schedule)
        assert score < 100.0
        assert details

    def test_single_room_scores_100(self) -> None:
        schedule = [_entry("Mon", 1, "r1"), _entry("Tue", 1, "r1")]
        assert (
            room_stability(_problem(advanced=self.LISTED, rooms=self.ROOMS), schedule)[0] == 100.0
        )

    def test_unlisted_subjects_are_ignored(self) -> None:
        schedule = [_entry("Mon", 1, "r1"), _entry("Tue", 1, "r2")]
        assert room_stability(_problem(rooms=self.ROOMS), schedule)[0] == 100.0
