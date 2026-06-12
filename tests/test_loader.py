"""Tests for YAML/JSON loader - fixture loading, round-trips, and error handling."""

import json
from pathlib import Path

import pytest

from timetable_solver.io.loader import LoadError, load_json, load_problem, load_yaml
from timetable_solver.models import TimetableProblem


class TestLoadYaml:
    def test_load_minimal(self, fixtures_dir: Path) -> None:
        problem = load_yaml(fixtures_dir / "minimal.yaml")
        assert isinstance(problem, TimetableProblem)
        assert len(problem.subjects) == 1
        assert problem.subjects[0].id == "math101"

    def test_load_small_school(self, fixtures_dir: Path) -> None:
        problem = load_yaml(fixtures_dir / "small_school.yaml")
        assert len(problem.teachers) == 3
        assert len(problem.student_groups) == 2
        assert len(problem.subjects) == 8
        assert len(problem.rooms) == 3
        assert len(problem.pre_assignments) == 1

    def test_load_vtu_department(self, fixtures_dir: Path) -> None:
        problem = load_yaml(fixtures_dir / "vtu_department.yaml")
        assert len(problem.student_groups) == 3
        assert problem.time_structure.get_slots_for_day("Saturday") == 4
        assert problem.time_structure.get_slots_for_day("Monday") == 8

    def test_file_not_found(self, fixtures_dir: Path) -> None:
        with pytest.raises(LoadError, match="File not found"):
            load_yaml(fixtures_dir / "nonexistent.yaml")

    def test_invalid_yaml(self, tmp_path: Path) -> None:
        bad_file = tmp_path / "bad.yaml"
        bad_file.write_text("{ invalid yaml: [")
        with pytest.raises(LoadError, match="Invalid YAML"):
            load_yaml(bad_file)

    def test_non_mapping_rejected(self, tmp_path: Path) -> None:
        bad_file = tmp_path / "list.yaml"
        bad_file.write_text("- item1\n- item2\n")
        with pytest.raises(LoadError, match="Expected a YAML mapping"):
            load_yaml(bad_file)


class TestLoadJson:
    def test_load_from_json(self, fixtures_dir: Path) -> None:
        """Round-trip: load YAML → dump dict → write JSON → load JSON."""
        problem = load_yaml(fixtures_dir / "minimal.yaml")
        json_path = fixtures_dir.parent / "tmp_test.json"
        try:
            json_path.write_text(json.dumps(problem.model_dump(), indent=2))
            reloaded = load_json(json_path)
            assert reloaded.subjects[0].id == problem.subjects[0].id
            assert reloaded.time_structure.days == problem.time_structure.days
        finally:
            json_path.unlink(missing_ok=True)


class TestLoadProblem:
    def test_auto_detect_yaml(self, fixtures_dir: Path) -> None:
        problem = load_problem(fixtures_dir / "minimal.yaml")
        assert isinstance(problem, TimetableProblem)

    def test_unsupported_extension(self, tmp_path: Path) -> None:
        bad_file = tmp_path / "data.toml"
        bad_file.write_text("")
        with pytest.raises(LoadError, match="Unsupported file format"):
            load_problem(bad_file)

    def test_string_path_accepted(self, fixtures_dir: Path) -> None:
        problem = load_problem(str(fixtures_dir / "minimal.yaml"))
        assert isinstance(problem, TimetableProblem)


class TestRoundTrip:
    def test_model_dump_and_reload(self, fixtures_dir: Path) -> None:
        """Ensure model_dump → load_problem_from_dict preserves data."""
        from timetable_solver.io.loader import load_problem_from_dict

        original = load_yaml(fixtures_dir / "small_school.yaml")
        data = original.model_dump()
        reloaded = load_problem_from_dict(data)

        assert len(reloaded.subjects) == len(original.subjects)
        assert reloaded.time_structure.days == original.time_structure.days
        assert reloaded.constraints.soft.minimize_student_gaps == 70
