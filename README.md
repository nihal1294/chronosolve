<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-animated.svg" />
    <source media="(prefers-color-scheme: light)" srcset="assets/logo-animated-light.svg" />
    <img src="assets/logo-animated.svg" alt="ChronoSolve" width="200" />
  </picture>
</p>

<h1 align="center">ChronoSolve</h1>

<p align="center">A generalized university course timetable scheduling solver powered by constraint optimization.</p>

## What It Does

ChronoSolve generates conflict-free timetables for educational institutions. Unlike rigid, institution-specific tools, it treats every scheduling detail; days, time slots, rooms, teacher preferences, etc; as configurable input rather than hardcoded assumptions.

**Core solver:** [Google OR-Tools CP-SAT](https://developers.google.com/optimization/cp/cp_solver) - a production-grade constraint programming solver that finds optimal (or near-optimal) schedules while respecting hard constraints and maximizing soft preferences.

**Hard constraints** (must be satisfied):

- No teacher/student group/room clashes
- Required teaching hours per subject
- Teacher and group availability
- Consecutive hours for lab sessions

**Soft constraints** (optimized with configurable weights):

- Minimize student gaps between classes
- Respect teacher time preferences (morning slots, free days, leave early)
- Spread subjects across the week
- Balance teacher workload

## Tech Stack

| Component | Technology |
| --------------- | -------------------------------------------------------- |
| Solver | Python 3.14+ · Google OR-Tools CP-SAT |
| Data models | Pydantic v2 |
| Input format | YAML / JSON |
| CLI | Typer |
| Desktop app | Tauri v2 · React · TypeScript · Tailwind CSS _(planned)_ |
| Package manager | uv |

## Quick Start

```bash
uv sync

# Print an example input to start from
uv run timetable template > my_school.yaml

# Validate without solving
uv run timetable validate my_school.yaml

# Solve and print per-group timetables (also: --format json|csv, -o out.json)
uv run timetable solve my_school.yaml --time-limit 60

# Score an existing schedule against the constraints
uv run timetable score my_school.yaml result.json

# Run the sidecar API server (prints PORT=<n> for the desktop app)
uv run python -m timetable_solver.server
```

Library usage:

```python
from timetable_solver import load_problem, solve, score_schedule

problem = load_problem("my_school.yaml")
result = solve(problem, time_limit=60)   # refine=True adds annealing
print(result.status, result.quality_score)
```

Tests: `uv run pytest tests/ --cov=src`

A real-world example lives in `examples/nmamit_cse_sem3.yaml` (a 4-section CSE semester converted from a legacy generator), with matching CSVs under `examples/import/` for the desktop app's import wizard.

With [just](https://github.com/casey/just) installed, common workflows are one command (recipes wrap `scripts/workflow.sh`):

```bash
just check   # every CI quality gate locally (ruff, pytest, eslint, vitest, clippy)
just solve   # CLI smoke: template -> validate -> solve
just web     # browser dev mode: sidecar + Vite wired together
just dev     # full desktop app (Tauri)
```

### Desktop app (development)

Requires Node 20+, Rust (via [rustup](https://rustup.rs)), and `uv` on PATH - the app spawns the solver sidecar with `uv run` and discovers its port automatically:

```bash
cd app
npm install
npm run tauri dev   # opens the ChronoSolve window
npm run test        # frontend unit tests (Vitest)
```

## Status

Python solver complete: CP-SAT core (hard + 10 weighted soft constraints, room assignment, lab blocks, pre-assignments), independent quality scorer, statistics, CLI, FastAPI sidecar with SSE progress, and simulated-annealing refinement.

Desktop app (Tauri): three-pane editing shell with YAML editor, entity tables with add/edit/delete dialogs and right-click menus, timeline with pin/unpin, constraints editor, native file open/save, and a CSV import wizard with column auto-matching and solver-side validation. Next: live solve progress (SSE), score reports + exports, then packaging.

## License

[Apache License 2.0](LICENSE)
