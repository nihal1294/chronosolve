"""FastAPI sidecar server - thin HTTP wrapper for the Tauri desktop app.

Run with `python -m timetable_solver.server [--port N]`. Prints `PORT=<n>` to
stdout on startup so the Tauri shell can discover the auto-selected port.
"""

import argparse
import asyncio
import json
import os
import socket
import sys
import threading
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from timetable_solver import load_problem_from_dict, score_schedule, solve, validate_problem
from timetable_solver.io.loader import LoadError
from timetable_solver.io.template import get_template
from timetable_solver.models import ScheduleEntry, SolveResult, TimetableProblem
from timetable_solver.scoring.quality import QualityReport
from timetable_solver.validation.validator import Severity

VERSION = "0.1.0"

app = FastAPI(title="ChronoSolve Solver", version=VERSION)
# Origins: vite dev (localhost:1420), packaged Tauri webviews - macOS/Linux use
# tauri://localhost, Windows uses http(s)://tauri.localhost.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(https?://((tauri\.)?localhost|127\.0\.0\.1)(:\d+)?|tauri://localhost)$",
    allow_methods=["*"],
    allow_headers=["*"],
)


class SolveRequest(BaseModel):
    problem: dict[str, Any]
    time_limit: int = 60


class ScoreRequest(BaseModel):
    problem: dict[str, Any]
    schedule: list[dict[str, Any]]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": VERSION}


@app.post("/validate")
def validate(request: SolveRequest) -> dict[str, list[str]]:
    problem = _parse_problem(request.problem)
    issues = validate_problem(problem)
    return {
        "errors": [i.message for i in issues if i.severity == Severity.ERROR],
        "warnings": [i.message for i in issues if i.severity == Severity.WARNING],
    }


@app.post("/solve")
def solve_endpoint(request: SolveRequest) -> SolveResult:
    # Sync endpoint: FastAPI runs it in a worker thread, keeping the loop free.
    problem = _parse_problem(request.problem)
    return solve(problem, time_limit=request.time_limit)


@app.post("/solve/stream")
async def solve_stream(request: SolveRequest) -> EventSourceResponse:
    """Solve while streaming progress events, ending with one `result` event."""
    problem = _parse_problem(request.problem)
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    loop = asyncio.get_running_loop()
    # Set when the client disconnects so the CPU-bound solve stops cooperatively
    # instead of running to its time limit in an orphaned background thread.
    cancelled = threading.Event()

    def on_progress(event: Any) -> None:
        # Called from CP-SAT's search thread - hop back onto the event loop.
        loop.call_soon_threadsafe(
            queue.put_nowait,
            {
                "event": "progress",
                "data": {
                    "objective": event.objective,
                    "elapsed": event.wall_time_seconds,
                    "solution_count": event.solution_count,
                },
            },
        )

    async def run_solver() -> None:
        try:
            result = await asyncio.to_thread(
                solve, problem, request.time_limit, on_progress, cancel_check=cancelled.is_set
            )
            await queue.put({"event": "result", "data": result.model_dump()})
        except Exception as exc:  # surface solver crashes to the client
            await queue.put({"event": "error", "data": {"message": str(exc)}})
        finally:
            await queue.put(None)

    async def event_source() -> Any:
        task = asyncio.create_task(run_solver())
        try:
            while (item := await queue.get()) is not None:
                yield {"event": item["event"], "data": json.dumps(item["data"])}
        finally:
            # Client gone or stream done: signal the solver to stop, then drain
            # the task so no orphaned solve thread outlives the request.
            cancelled.set()
            await task

    return EventSourceResponse(event_source())


@app.post("/score")
def score(request: ScoreRequest) -> QualityReport:
    problem = _parse_problem(request.problem)
    entries = [ScheduleEntry.model_validate(item) for item in request.schedule]
    return score_schedule(problem, entries)


@app.get("/template")
def template() -> dict[str, str]:
    return {"yaml": get_template("yaml"), "json": get_template("json")}


def _parse_problem(data: dict[str, Any]) -> TimetableProblem:
    """Parse a raw problem dict, mapping load failures to HTTP 422."""
    try:
        return load_problem_from_dict(data)
    except LoadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _find_free_port() -> int:
    """Ask the OS for an available localhost port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def _exit_on_stdin_close() -> None:
    """Exit when stdin reaches EOF - i.e. when the parent app is gone.

    The desktop shell spawns this server with a stdin pipe it never writes to.
    If the shell dies for any reason (clean quit, crash, force-kill), the pipe
    closes and this watchdog terminates the orphaned sidecar.
    """
    try:
        sys.stdin.buffer.read()
    except Exception:  # noqa: BLE001 - any stdin failure means the parent is gone
        pass
    os._exit(0)


def main() -> None:
    """Start the sidecar: announce the port on stdout, then serve."""
    import uvicorn

    parser = argparse.ArgumentParser(description="ChronoSolve sidecar server")
    parser.add_argument("--port", type=int, default=0, help="0 = auto-select")
    parser.add_argument(
        "--parent-watchdog",
        action="store_true",
        help="Exit when stdin closes (used when spawned as a desktop sidecar)",
    )
    args = parser.parse_args()
    if args.parent_watchdog:
        threading.Thread(target=_exit_on_stdin_close, daemon=True).start()
    port = args.port or _find_free_port()
    print(f"PORT={port}", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
