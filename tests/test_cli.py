"""CLI command tests via Typer's CliRunner."""

import json
from pathlib import Path

import yaml
from typer.testing import CliRunner

from timetable_solver.cli import app

runner = CliRunner()


class TestSolveCommand:
    def test_solve_to_table(self, fixtures_dir: Path) -> None:
        result = runner.invoke(app, ["solve", str(fixtures_dir / "minimal.yaml")])
        assert result.exit_code == 0
        assert "optimal" in result.output
        assert "math101" in result.output

    def test_solve_to_json_file(self, fixtures_dir: Path, tmp_path: Path) -> None:
        out = tmp_path / "result.json"
        result = runner.invoke(
            app,
            ["solve", str(fixtures_dir / "small_school.yaml"),
             "-o", str(out), "--format", "json", "--time-limit", "30"],
        )
        assert result.exit_code == 0
        payload = json.loads(out.read_text())
        assert payload["status"] == "optimal"
        assert len(payload["schedule"]) == 24

    def test_solve_missing_file_fails(self) -> None:
        result = runner.invoke(app, ["solve", "nope.yaml"])
        assert result.exit_code == 1

    def test_solve_infeasible_input_fails_validation(self, tmp_path: Path) -> None:
        """A group needing more hours than exist exits 1 before solving."""
        bad = tmp_path / "bad.yaml"
        bad.write_text(yaml.safe_dump({
            "time_structure": {"days": ["Monday"], "slots_per_day": 2},
            "teachers": [{"id": "t1", "name": "T"}],
            "student_groups": [{"id": "g1", "name": "G", "size": 10}],
            "subjects": [{"id": "s1", "name": "S", "hours_per_week": 5,
                          "teacher_ids": ["t1"], "group_ids": ["g1"]}],
        }))
        result = runner.invoke(app, ["solve", str(bad)])
        assert result.exit_code == 1


class TestValidateCommand:
    def test_valid_fixture_passes(self, fixtures_dir: Path) -> None:
        result = runner.invoke(app, ["validate", str(fixtures_dir / "small_school.yaml")])
        assert result.exit_code == 0
        assert "passed" in result.output

    def test_malformed_yaml_fails(self, tmp_path: Path) -> None:
        bad = tmp_path / "broken.yaml"
        bad.write_text("just: [unclosed")
        result = runner.invoke(app, ["validate", str(bad)])
        assert result.exit_code == 1


class TestScoreCommand:
    def test_score_solver_output(self, fixtures_dir: Path, tmp_path: Path) -> None:
        out = tmp_path / "result.json"
        runner.invoke(
            app,
            ["solve", str(fixtures_dir / "minimal.yaml"), "-o", str(out), "-f", "json"],
        )
        result = runner.invoke(
            app, ["score", str(fixtures_dir / "minimal.yaml"), str(out)]
        )
        assert result.exit_code == 0
        assert "Overall score" in result.output

    def test_score_unreadable_schedule_fails(self, fixtures_dir: Path, tmp_path: Path) -> None:
        bad = tmp_path / "junk.json"
        bad.write_text("not json")
        result = runner.invoke(
            app, ["score", str(fixtures_dir / "minimal.yaml"), str(bad)]
        )
        assert result.exit_code == 1


class TestTemplateCommand:
    def test_yaml_template_is_loadable(self) -> None:
        result = runner.invoke(app, ["template"])
        assert result.exit_code == 0
        parsed = yaml.safe_load(result.output)
        assert "time_structure" in parsed

    def test_json_template_is_parseable(self) -> None:
        result = runner.invoke(app, ["template", "--format", "json"])
        assert result.exit_code == 0
        assert "time_structure" in json.loads(result.output)
