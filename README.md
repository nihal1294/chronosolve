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

**Works for any level of education.** Because days, slots, rooms, student groups, and constraints are all configuration (never hardcoded), the same solver schedules schools (K-12), pre-university and junior colleges, colleges, universities, and coaching or training centers. A "student group" is any cohort that attends classes together (a class, section, batch, or year), so any institution that schedules groups against teachers, rooms, and time slots is in scope.

The one case it does not model is fully individualized per-student timetables, where every student picks a unique combination of electives and needs a personal schedule. ChronoSolve schedules at the group level, which fits the vast majority of schools and university programs.

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
| Desktop app | Tauri v2 · React · TypeScript · Tailwind CSS |
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

### Using the desktop app

The left sidebar follows the workflow top to bottom:

1. **Dashboard** - your home base. Load the worked example, open a YAML/JSON file, or import CSV to get started. Shows live entity counts and a Data -> Constraints -> Schedule progress pipeline.
2. **Data** - edit courses, instructors, student groups, and rooms as tables, or switch to the YAML view to edit the raw definition. Import entities from CSV with column auto-matching.
3. **Constraints** - toggle the hard rules every timetable must satisfy and weight the soft preferences. _(in progress)_
4. **Scheduler** - run the solver and watch it converge live (best result and solutions-found stream in); cancel any time.
5. **Timetable** - view the generated schedule by class, teacher, or room (or a master overview), filter by type/department/semester, and pin sessions you want to keep.

A ⌘K command palette and keyboard shortcuts drive every action, and the whole app supports light and dark themes.

## Status

**Solver (complete):** CP-SAT core with hard constraints plus 10 weighted soft constraints, room assignment, lab blocks, and pre-assignments; an independent quality scorer and statistics; the Typer CLI; and a FastAPI sidecar that streams solve progress over SSE, with simulated-annealing refinement.

**Desktop app (in progress):** a route-based shell with a journey-first Dashboard, a Data workspace (entity tables + raw YAML editor + CSV import wizard), a live Scheduler monitor (SSE progress, cancellable), and a filterable Timetable view with pin/unpin. The Constraints and Settings screens, plus analytics and export, are being rebuilt onto the new shell.

**Next:** constraint rule cards, analytics and export, then packaging (PyInstaller sidecar bundle, signed macOS .dmg and Windows installer) and PDF/ICS exporters.

## License

[Apache License 2.0](LICENSE)
