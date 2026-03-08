# ChronoSolve - Project Context

## What This Is

A generalized university course timetable scheduling solver. Takes configurable inputs (teachers, subjects, student groups, rooms, constraints) and produces optimal conflict-free timetables using Google OR-Tools CP-SAT.

## Architecture

Two-part system (same repo):

1. **Python solver library** (`src/timetable_solver/`): core CP-SAT solver, Pydantic models, CLI (Typer), FastAPI sidecar server
2. **Tauri v2 desktop app** (`app/`): React/TypeScript frontend, communicates with solver via local HTTP (sidecar pattern)

The solver is a standalone Python library usable via CLI or API. The desktop app wraps it for non-technical users.

## Tech Stack

- **Solver:** Python 3.14+, Google OR-Tools CP-SAT, Pydantic v2, Typer
- **Desktop:** Tauri v2, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Package manager:** uv (Python), npm (frontend)
- **Input format:** YAML and JSON

## Key Design Decisions

- CP-SAT over greedy heuristics - guarantees valid solutions, supports soft constraint optimization
- Hard constraints (inviolable) vs soft constraints (weighted preferences) - prevents infeasibility from over-constrained inputs
- Tauri v2 sidecar pattern - solver packaged as PyInstaller binary, runs FastAPI on localhost, Tauri manages lifecycle
- Local HTTP over stdin/stdout for IPC - proven pattern, debuggable, supports SSE for progress streaming

## Project Conventions

- Input config is YAML/JSON, never hardcoded
- Every institution-specific detail is configurable (days, slots, rooms, constraints)
- Solver core has no UI dependencies, can run headless via CLI

## Commands

- **Python tests:** `uv run pytest tests/ --cov=. --cov-report=term-missing`
- **Run CLI:** `uv run python -m timetable_solver.cli`
- **Run sidecar server:** `uv run python -m timetable_solver.server`
