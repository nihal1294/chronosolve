"""Backend half of the frontend conflict-checker contract (M8a).

The fixtures in app/src/lib/conflict-contract.fixtures.json are executed by
BOTH suites: vitest asserts lib/conflicts.ts emits exactly the expected kinds,
and this module asserts the authoritative find_hard_violations agrees - each
expected python_substring appears, and clean cases produce zero violations.
A change to either side that breaks the mirror fails its half.
"""

import json
from pathlib import Path

import pytest

from timetable_solver.models import ScheduleEntry, TimetableProblem
from timetable_solver.scoring.violations import find_hard_violations

FIXTURES = (
    Path(__file__).resolve().parent.parent
    / "app"
    / "src"
    / "lib"
    / "conflict-contract.fixtures.json"
)
CASES = json.loads(FIXTURES.read_text())["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_backend_agrees_with_the_fixture(case: dict) -> None:
    problem = TimetableProblem.model_validate(case["problem"])
    schedule = [ScheduleEntry.model_validate(entry) for entry in case["schedule"]]
    violations = find_hard_violations(problem, schedule)
    if not case["expect"]:
        assert violations == []
        return
    for expected in case["expect"]:
        fragment = expected["python_substring"]
        assert any(fragment in v for v in violations), (
            f"backend never said {fragment!r}; got: {violations}"
        )
