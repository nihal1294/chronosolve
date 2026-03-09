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
| --------- | ---------- |
| Solver | Python 3.14+ · Google OR-Tools CP-SAT |
| Data models | Pydantic v2 |
| Input format | YAML / JSON |
| CLI | Typer |
| Desktop app | Tauri v2 · React · TypeScript · Tailwind CSS _(planned)_ |
| Package manager | uv |

## Status

Early development, solver core is being built first, desktop app will follow.

## License

[Apache License 2.0](LICENSE)
