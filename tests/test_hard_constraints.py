"""Per-constraint tests: each hard constraint toggle flips feasibility.

Every test constructs a problem that is infeasible *because of* one constraint,
then disables that constraint and asserts it becomes solvable. If someone
deletes a constraint builder, the "on" half of its test fails.
"""

from timetable_solver import solve
from timetable_solver.models import (
    ConstraintsConfig,
    HardConstraints,
    Room,
    StudentGroup,
    Subject,
    Teacher,
    TimeStructure,
    TimetableProblem,
)

ONE_SLOT_DAY = TimeStructure(days=["Monday"], slots_per_day=1)


def _subject(sid: str, teacher: str, group: str, hours: int = 1) -> Subject:
    return Subject(
        id=sid,
        name=sid,
        hours_per_week=hours,
        max_per_day=hours,
        teacher_ids=[teacher],
        group_ids=[group],
    )


def _config(**overrides: bool) -> ConstraintsConfig:
    return ConstraintsConfig(hard=HardConstraints(**overrides))


class TestTeacherNoClash:
    def _problem(self, enabled: bool) -> TimetableProblem:
        return TimetableProblem(
            time_structure=ONE_SLOT_DAY,
            teachers=[Teacher(id="t1", name="T")],
            student_groups=[
                StudentGroup(id="g1", name="A", size=10),
                StudentGroup(id="g2", name="B", size=10),
            ],
            subjects=[_subject("s1", "t1", "g1"), _subject("s2", "t1", "g2")],
            constraints=_config(teacher_no_clash=enabled),
        )

    def test_enabled_is_infeasible(self) -> None:
        assert solve(self._problem(True), time_limit=5).status == "infeasible"

    def test_disabled_allows_overlap(self) -> None:
        result = solve(self._problem(False), time_limit=5)
        assert result.status == "optimal"
        assert len(result.schedule) == 2


class TestGroupNoClash:
    def _problem(self, enabled: bool) -> TimetableProblem:
        return TimetableProblem(
            time_structure=ONE_SLOT_DAY,
            teachers=[Teacher(id="t1", name="T1"), Teacher(id="t2", name="T2")],
            student_groups=[StudentGroup(id="g1", name="A", size=10)],
            subjects=[_subject("s1", "t1", "g1"), _subject("s2", "t2", "g1")],
            constraints=_config(group_no_clash=enabled),
        )

    def test_enabled_is_infeasible(self) -> None:
        assert solve(self._problem(True), time_limit=5).status == "infeasible"

    def test_disabled_allows_overlap(self) -> None:
        assert solve(self._problem(False), time_limit=5).status == "optimal"


class TestRoomNoClash:
    def _problem(self, enabled: bool) -> TimetableProblem:
        return TimetableProblem(
            time_structure=ONE_SLOT_DAY,
            teachers=[Teacher(id="t1", name="T1"), Teacher(id="t2", name="T2")],
            student_groups=[
                StudentGroup(id="g1", name="A", size=10),
                StudentGroup(id="g2", name="B", size=10),
            ],
            subjects=[_subject("s1", "t1", "g1"), _subject("s2", "t2", "g2")],
            rooms=[Room(id="r1", name="Only Room", capacity=30)],
            constraints=_config(room_no_clash=enabled),
        )

    def test_enabled_is_infeasible(self) -> None:
        assert solve(self._problem(True), time_limit=5).status == "infeasible"

    def test_disabled_shares_the_room(self) -> None:
        result = solve(self._problem(False), time_limit=5)
        assert result.status == "optimal"
        assert [e.room_id for e in result.schedule] == ["r1", "r1"]


class TestRespectAvailability:
    def _problem(self, enabled: bool) -> TimetableProblem:
        return TimetableProblem(
            time_structure=ONE_SLOT_DAY,
            teachers=[Teacher(id="t1", name="T", unavailable={"Monday": [1]})],
            student_groups=[StudentGroup(id="g1", name="A", size=10)],
            subjects=[_subject("s1", "t1", "g1")],
            constraints=_config(respect_availability=enabled),
        )

    def test_enabled_is_infeasible(self) -> None:
        assert solve(self._problem(True), time_limit=5).status == "infeasible"

    def test_disabled_uses_blocked_slot(self) -> None:
        assert solve(self._problem(False), time_limit=5).status == "optimal"


class TestRequiredHours:
    def _problem(self, enabled: bool) -> TimetableProblem:
        return TimetableProblem(
            time_structure=ONE_SLOT_DAY,
            teachers=[Teacher(id="t1", name="T")],
            student_groups=[StudentGroup(id="g1", name="A", size=10)],
            subjects=[_subject("s1", "t1", "g1", hours=2)],
            constraints=_config(required_hours=enabled),
        )

    def test_enabled_is_infeasible(self) -> None:
        assert solve(self._problem(True), time_limit=5).status == "infeasible"

    def test_disabled_is_satisfiable(self) -> None:
        result = solve(self._problem(False), time_limit=5)
        assert result.status == "optimal"
        assert "s1" in result.unresolved


class TestConsecutiveBlocks:
    def test_block_subject_with_default_max_per_day_solves(self) -> None:
        """Regression for amendment A2: max_per_day counts sessions, not slots.

        A 2-hour lab block with the default max_per_day=1 must be schedulable;
        under slot-counting semantics this would be infeasible.
        """
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Monday", "Tuesday"], slots_per_day=4),
            teachers=[Teacher(id="t1", name="T")],
            student_groups=[StudentGroup(id="g1", name="A", size=10)],
            subjects=[
                Subject(
                    id="lab",
                    name="Lab",
                    hours_per_week=2,
                    type="lab",
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                    consecutive_hours=2,
                ),
            ],
        )
        result = solve(problem, time_limit=5)
        assert result.status == "optimal"
        slots = sorted(e.slot for e in result.schedule)
        days = {e.day for e in result.schedule}
        assert len(days) == 1 and slots[1] == slots[0] + 1

    def test_two_blocks_split_across_days(self) -> None:
        """4 hours in blocks of 2 with max_per_day=1 needs two separate days."""
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Mon", "Tue", "Wed"], slots_per_day=4),
            teachers=[Teacher(id="t1", name="T")],
            student_groups=[StudentGroup(id="g1", name="A", size=10)],
            subjects=[
                Subject(
                    id="lab",
                    name="Lab",
                    hours_per_week=4,
                    type="lab",
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                    consecutive_hours=2,
                ),
            ],
        )
        result = solve(problem, time_limit=5)
        assert result.status == "optimal"
        per_day: dict[str, list[int]] = {}
        for entry in result.schedule:
            per_day.setdefault(entry.day, []).append(entry.slot)
        assert len(per_day) == 2
        for slots in per_day.values():
            slots.sort()
            assert slots[1] == slots[0] + 1


class TestGroupMaxHours:
    def _problem(self, days: list[str]) -> TimetableProblem:
        """A 2-hour subject for a group capped at 1 class hour per day."""
        return TimetableProblem(
            time_structure=TimeStructure(days=days, slots_per_day=4),
            teachers=[Teacher(id="t1", name="T")],
            student_groups=[StudentGroup(id="g1", name="A", size=10, max_hours_per_day=1)],
            subjects=[_subject("s1", "t1", "g1", hours=2)],
        )

    def test_cap_forces_split_across_days(self) -> None:
        result = solve(self._problem(["Mon", "Tue"]), time_limit=5)
        assert result.status == "optimal"
        assert len({e.day for e in result.schedule}) == 2

    def test_cap_makes_single_day_infeasible(self) -> None:
        assert solve(self._problem(["Mon"]), time_limit=5).status == "infeasible"


class TestMaxPerDay:
    def test_theory_hours_spread_across_days(self) -> None:
        """max_per_day=1 forces 3 hours onto 3 distinct days."""
        problem = TimetableProblem(
            time_structure=TimeStructure(days=["Mon", "Tue", "Wed"], slots_per_day=4),
            teachers=[Teacher(id="t1", name="T")],
            student_groups=[StudentGroup(id="g1", name="A", size=10)],
            subjects=[
                Subject(
                    id="s1",
                    name="S",
                    hours_per_week=3,
                    max_per_day=1,
                    teacher_ids=["t1"],
                    group_ids=["g1"],
                ),
            ],
        )
        result = solve(problem, time_limit=5)
        assert result.status == "optimal"
        assert len({e.day for e in result.schedule}) == 3
