"""The checked-in examples must stay loadable, valid, and solvable."""

from pathlib import Path

from timetable_solver import load_problem, solve, validate_problem

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"


def test_nmamit_sem3_example_loads_validates_and_solves() -> None:
    """The NMAMIT sem-3 conversion stays a working end-to-end problem."""
    problem = load_problem(EXAMPLES / "nmamit_cse_sem3.yaml")
    errors = [issue for issue in validate_problem(problem) if issue.severity == "error"]
    assert errors == []

    result = solve(problem, time_limit=60)
    assert result.status in ("optimal", "feasible")

    # Section A's Maths hours stay where the legacy grid pinned them.
    maths_slots = {
        (entry.day, entry.slot) for entry in result.schedule if entry.subject_id == "MATHS-A"
    }
    assert {("Monday", 1), ("Tuesday", 6), ("Thursday", 4), ("Saturday", 3)} <= maths_slots

    # Every section's lab lands as two 3-hour blocks on distinct days.
    lab_a = sorted(
        (entry.day, entry.slot) for entry in result.schedule if entry.subject_id == "DS-DSD-LAB-A"
    )
    assert len(lab_a) == 6
    assert len({day for day, _ in lab_a}) == 2
