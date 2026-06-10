"""Load timetable problems from YAML, JSON, or raw dicts."""

import json
from pathlib import Path

import yaml
from pydantic import ValidationError

from timetable_solver.models.problem import TimetableProblem


class LoadError(Exception):
    """Raised when a problem file cannot be loaded or parsed."""


def load_yaml(path: Path) -> TimetableProblem:
    """Load a timetable problem from a YAML file.

    Args:
        path: Path to the YAML file.

    Returns:
        Validated TimetableProblem instance.

    Raises:
        LoadError: If the file cannot be read or parsed.
    """
    data = _read_yaml(path)
    return _build_problem(data, source=str(path))


def load_json(path: Path) -> TimetableProblem:
    """Load a timetable problem from a JSON file.

    Args:
        path: Path to the JSON file.

    Returns:
        Validated TimetableProblem instance.

    Raises:
        LoadError: If the file cannot be read or parsed.
    """
    data = _read_json(path)
    return _build_problem(data, source=str(path))


def load_problem(path: Path | str) -> TimetableProblem:
    """Load a timetable problem, auto-detecting format by extension.

    Args:
        path: Path to a .yaml, .yml, or .json file.

    Returns:
        Validated TimetableProblem instance.

    Raises:
        LoadError: If format is unsupported or file is invalid.
    """
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix in {".yaml", ".yml"}:
        return load_yaml(path)
    if suffix == ".json":
        return load_json(path)
    raise LoadError(f"Unsupported file format: {suffix!r} (expected .yaml, .yml, or .json)")


def load_problem_from_dict(data: dict) -> TimetableProblem:
    """Construct a TimetableProblem from a raw dictionary.

    Args:
        data: Dictionary matching the TimetableProblem schema.

    Returns:
        Validated TimetableProblem instance.

    Raises:
        LoadError: If validation fails.
    """
    return _build_problem(data, source="dict")


def _read_yaml(path: Path) -> dict:
    """Read and parse a YAML file into a dict."""
    try:
        text = path.read_text(encoding="utf-8")
        data = yaml.safe_load(text)
    except FileNotFoundError:
        raise LoadError(f"File not found: {path}")
    except yaml.YAMLError as exc:
        raise LoadError(f"Invalid YAML in {path}: {exc}")
    if not isinstance(data, dict):
        raise LoadError(f"Expected a YAML mapping in {path}, got {type(data).__name__}")
    return data


def _read_json(path: Path) -> dict:
    """Read and parse a JSON file into a dict."""
    try:
        text = path.read_text(encoding="utf-8")
        data = json.loads(text)
    except FileNotFoundError:
        raise LoadError(f"File not found: {path}")
    except json.JSONDecodeError as exc:
        raise LoadError(f"Invalid JSON in {path}: {exc}")
    if not isinstance(data, dict):
        raise LoadError(f"Expected a JSON object in {path}, got {type(data).__name__}")
    return data


def _build_problem(data: dict, *, source: str) -> TimetableProblem:
    """Validate a dict against the TimetableProblem schema."""
    try:
        return TimetableProblem.model_validate(data)
    except ValidationError as exc:
        raise LoadError(f"Validation failed for {source}:\n{exc}")
