"""FastAPI sidecar endpoint tests via TestClient."""

import json
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from timetable_solver.server import app

client = TestClient(app)


@pytest.fixture
def minimal_payload(fixtures_dir: Path) -> dict:
    return yaml.safe_load((fixtures_dir / "minimal.yaml").read_text())


class TestHealth:
    def test_health_ok(self) -> None:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


class TestCors:
    """Every webview origin the app ships with must pass CORS preflight."""

    @pytest.mark.parametrize(
        "origin",
        [
            "http://localhost:1420",  # vite dev
            "tauri://localhost",  # packaged macOS/Linux
            "http://tauri.localhost",  # packaged Windows
            "https://tauri.localhost",
        ],
    )
    def test_allowed_origins(self, origin: str) -> None:
        response = client.get("/health", headers={"Origin": origin})
        assert response.headers.get("access-control-allow-origin") == origin

    def test_foreign_origin_rejected(self) -> None:
        response = client.get("/health", headers={"Origin": "https://evil.example"})
        assert "access-control-allow-origin" not in response.headers


class TestValidate:
    def test_valid_problem_returns_no_errors(self, minimal_payload: dict) -> None:
        response = client.post("/validate", json={"problem": minimal_payload})
        assert response.status_code == 200
        assert response.json() == {"errors": [], "warnings": []}

    def test_overloaded_problem_returns_errors(self, minimal_payload: dict) -> None:
        minimal_payload["subjects"][0]["hours_per_week"] = 99
        minimal_payload["subjects"][0]["max_per_day"] = 99
        response = client.post("/validate", json={"problem": minimal_payload})
        assert response.status_code == 200
        assert response.json()["errors"]

    def test_malformed_problem_is_422(self) -> None:
        response = client.post("/validate", json={"problem": {"nonsense": True}})
        assert response.status_code == 422


class TestSolve:
    def test_solve_minimal(self, minimal_payload: dict) -> None:
        response = client.post("/solve", json={"problem": minimal_payload, "time_limit": 10})
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "optimal"
        assert len(body["schedule"]) == 3
        assert body["quality_score"] is not None


class TestSolveStream:
    def test_stream_ends_with_result_event(self, minimal_payload: dict) -> None:
        events: list[tuple[str, dict]] = []
        with client.stream(
            "POST", "/solve/stream", json={"problem": minimal_payload, "time_limit": 10}
        ) as response:
            assert response.status_code == 200
            current_event = ""
            for line in response.iter_lines():
                if line.startswith("event:"):
                    current_event = line.split(":", 1)[1].strip()
                elif line.startswith("data:"):
                    events.append((current_event, json.loads(line.split(":", 1)[1])))
        names = [name for name, _ in events]
        assert names[-1] == "result"
        result = events[-1][1]
        assert result["status"] == "optimal"
        assert len(result["schedule"]) == 3


class TestScore:
    def test_score_solved_schedule(self, minimal_payload: dict) -> None:
        solved = client.post("/solve", json={"problem": minimal_payload, "time_limit": 10}).json()
        response = client.post(
            "/score",
            json={"problem": minimal_payload, "schedule": solved["schedule"]},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["hard_violations"] == []
        assert body["overall_score"] > 0


class TestParentWatchdog:
    def test_server_exits_when_stdin_closes(self) -> None:
        """Sidecar lifecycle: --parent-watchdog must end the process on stdin EOF.

        This is what prevents orphaned solver processes when the desktop app
        dies without cleanly killing its child (regression for the leak found
        during M1 smoke testing).
        """
        import subprocess
        import sys

        process = subprocess.Popen(
            [sys.executable, "-m", "timetable_solver.server", "--parent-watchdog"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        try:
            assert process.stdout is not None
            assert process.stdout.readline().startswith(b"PORT=")
            assert process.stdin is not None
            process.stdin.close()  # simulate the parent app dying
            assert process.wait(timeout=10) == 0
        finally:
            if process.poll() is None:
                process.kill()


class TestTemplate:
    def test_template_served_in_both_formats(self) -> None:
        response = client.get("/template")
        assert response.status_code == 200
        body = response.json()
        assert "time_structure" in yaml.safe_load(body["yaml"])
        assert "time_structure" in json.loads(body["json"])
