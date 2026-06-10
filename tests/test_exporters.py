"""Exporter tests — JSON, CSV, and pretty-table output."""

import csv
import io
import json
from pathlib import Path

from timetable_solver import load_problem, solve
from timetable_solver.io.exporters import to_csv, to_json, to_pretty_table
from timetable_solver.models import SolveResult


class TestExporters:
    def test_json_round_trips(self, fixtures_dir: Path) -> None:
        problem = load_problem(fixtures_dir / "minimal.yaml")
        result = solve(problem, time_limit=10)
        parsed = json.loads(to_json(result))
        assert parsed["status"] == "optimal"
        assert len(parsed["schedule"]) == 3

    def test_csv_has_header_and_one_row_per_hour(self, fixtures_dir: Path) -> None:
        problem = load_problem(fixtures_dir / "small_school.yaml")
        result = solve(problem, time_limit=30)
        rows = list(csv.reader(io.StringIO(to_csv(result))))
        assert rows[0] == ["day", "slot", "subject", "teachers", "groups", "room"]
        assert len(rows) == len(result.schedule) + 1
        assert all(row[5] for row in rows[1:])  # every entry has a room

    def test_pretty_table_renders_groups_and_subjects(self, fixtures_dir: Path) -> None:
        problem = load_problem(fixtures_dir / "small_school.yaml")
        result = solve(problem, time_limit=30)
        text = to_pretty_table(result, problem)
        assert "Section A" in text and "Section B" in text
        assert "math_a" in text and "lab_b" in text
        assert "9:00 - 9:55" in text  # slot labels used when problem provided
        assert "[lab1]" in text  # room labels render literally, not as Rich markup

    def test_pretty_table_without_problem(self, fixtures_dir: Path) -> None:
        problem = load_problem(fixtures_dir / "minimal.yaml")
        result = solve(problem, time_limit=10)
        text = to_pretty_table(result)
        assert "math101" in text and "g1" in text

    def test_pretty_table_empty_schedule(self) -> None:
        text = to_pretty_table(SolveResult(status="infeasible"))
        assert "infeasible" in text
