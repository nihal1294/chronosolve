"""Typer CLI - solve, validate, score, and template commands."""

import json
from enum import StrEnum
from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console

from timetable_solver import load_problem, score_schedule, validate_problem
from timetable_solver import solve as run_solver
from timetable_solver.io.exporters import to_csv, to_json, to_pretty_table
from timetable_solver.io.loader import LoadError
from timetable_solver.io.template import get_template
from timetable_solver.models import ScheduleEntry
from timetable_solver.validation.validator import Severity

app = typer.Typer(help="ChronoSolve - university timetable scheduling solver.")
console = Console()
err_console = Console(stderr=True)


class OutputFormat(StrEnum):
    json = "json"
    csv = "csv"
    table = "table"


@app.command()
def solve(
    input_file: Annotated[Path, typer.Argument(help="Problem YAML/JSON file.")],
    output: Annotated[Path | None, typer.Option("--output", "-o")] = None,
    time_limit: Annotated[int, typer.Option(help="Max solver seconds.")] = 60,
    fmt: Annotated[OutputFormat, typer.Option("--format", "-f")] = OutputFormat.table,
    refine: Annotated[bool, typer.Option(help="Refine with simulated annealing.")] = False,
) -> None:
    """Solve a timetable problem and export the schedule."""
    problem = _load_or_exit(input_file)
    if not _report_validation(problem):
        raise typer.Exit(code=1)
    with console.status("Solving...") as status:
        result = run_solver(
            problem,
            time_limit=time_limit,
            on_progress=lambda e: status.update(
                f"Solving... {e.solution_count} solution(s), objective {e.objective:.0f}"
            ),
            refine=refine,
        )
    console.print(
        f"Status: [bold]{result.status}[/bold] | quality: {result.quality_score} "
        f"| {result.solve_time_seconds:.2f}s"
    )
    if result.unresolved:
        err_console.print(f"[red]Unresolved subjects: {', '.join(result.unresolved)}[/red]")
        raise typer.Exit(code=1)
    rendered = {
        OutputFormat.json: lambda: to_json(result),
        OutputFormat.csv: lambda: to_csv(result),
        OutputFormat.table: lambda: to_pretty_table(result, problem),
    }[fmt]()
    if output:
        output.write_text(rendered, encoding="utf-8")
        console.print(f"Written to {output}")
    elif fmt == OutputFormat.table:
        console.print(rendered, markup=False)
    else:
        typer.echo(rendered)  # machine formats: no Rich line-wrapping


@app.command()
def validate(
    input_file: Annotated[Path, typer.Argument(help="Problem YAML/JSON file.")],
) -> None:
    """Validate a problem file without solving (exit 1 on errors)."""
    problem = _load_or_exit(input_file)
    if _report_validation(problem):
        console.print("[green]Validation passed.[/green]")
    else:
        raise typer.Exit(code=1)


@app.command()
def score(
    input_file: Annotated[Path, typer.Argument(help="Problem YAML/JSON file.")],
    schedule_file: Annotated[Path, typer.Argument(help="Schedule JSON (SolveResult or list).")],
) -> None:
    """Score an existing schedule against a problem's constraints."""
    problem = _load_or_exit(input_file)
    entries = _read_schedule_or_exit(schedule_file)
    report = score_schedule(problem, entries)
    console.print(f"Overall score: [bold]{report.overall_score}[/bold]")
    for name, value in report.metrics.items():
        console.print(f"  {name}: {value}")
        for issue in report.details.get(name, []):
            console.print(f"    - {issue}", style="dim")
    for violation in report.hard_violations:
        err_console.print(f"[red]VIOLATION: {violation}[/red]")
    if report.hard_violations:
        raise typer.Exit(code=1)


@app.command()
def template(
    fmt: Annotated[str, typer.Option("--format", "-f", help="yaml or json")] = "yaml",
) -> None:
    """Print an example problem input template."""
    typer.echo(get_template(fmt))  # plain echo: Rich wrapping would corrupt YAML


def _load_or_exit(path: Path):
    """Load a problem file, printing a friendly error and exiting on failure."""
    try:
        return load_problem(path)
    except LoadError as exc:
        err_console.print(f"[red]{exc}[/red]")
        raise typer.Exit(code=1) from exc


def _report_validation(problem) -> bool:
    """Print validation issues; return False when any are errors."""
    issues = validate_problem(problem)
    ok = True
    for issue in issues:
        if issue.severity == Severity.ERROR:
            err_console.print(f"[red]ERROR: {issue.message}[/red]")
            ok = False
        else:
            err_console.print(f"[yellow]WARNING: {issue.message}[/yellow]")
    return ok


def _read_schedule_or_exit(path: Path) -> list[ScheduleEntry]:
    """Read schedule entries from a SolveResult JSON, {"schedule": []}, or bare list."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        raw = data.get("schedule", []) if isinstance(data, dict) else data
        return [ScheduleEntry.model_validate(item) for item in raw]
    except (OSError, ValueError) as exc:
        err_console.print(f"[red]Cannot read schedule {path}: {exc}[/red]")
        raise typer.Exit(code=1) from exc


if __name__ == "__main__":
    app()
