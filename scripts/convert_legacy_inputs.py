"""Convert legacy NMAMIT timetable inputs into a ChronoSolve example.

Reads ``Sample Inputs/current.json`` from the 2017 timetable generator
(semester III: 4 CSE sections, 7 subjects, real faculty) and emits:

- ``examples/nmamit_cse_sem3.yaml``  - a solvable ChronoSolve problem
- ``examples/import/*.csv``          - the same data flattened with
  legacy-shaped headers, for the CSV import wizard demo

Usage: ``uv run python scripts/convert_legacy_inputs.py [legacy.json]``
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_LEGACY = Path.home() / "Projects/github_repos/timetable/Sample Inputs/current.json"
SEMESTER = "III"
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
SUBJECT_RE = re.compile(
    r"subject\('(?P<name>.*?)', '(?P<abbr>.*?)', (?P<hours>\d+), "
    r"(?P<is_lab>True|False), '(?P<code>.*?)'\)"
)

YAML_HEADER = """\
# NMAMIT CSE 3rd-semester problem, converted from the 2017 legacy
# timetable generator (scripts/convert_legacy_inputs.py).
#
# Faithful to the source: subjects, per-section faculty, 6x8 week,
# blocked slots (lunch / short days) as group unavailability, lab as
# two 3-hour blocks, and Section A's Maths slots pinned where the
# legacy grid fixed them. Rooms are invented - the legacy data had
# no room model. Cross-semester faculty load is out of scope.
"""


def slug(text: str) -> str:
    """Lowercase id-safe slug, e.g. "Sannidhan M S" -> "sannidhan_m_s"."""
    return re.sub(r"[^a-z0-9]+", "_", text.strip().lower()).strip("_")


def abbr_slug(abbr: str) -> str:
    """Uppercase subject-code slug, e.g. "DS | DSD Lab" -> "DS-DSD-LAB"."""
    return re.sub(r"[^A-Za-z0-9]+", "-", abbr.strip()).strip("-").upper()


def parse_subjects(raw: list[str]) -> dict[str, dict[str, Any]]:
    """Parse subject(...) repr-strings into {abbr: meta}."""
    subjects: dict[str, dict[str, Any]] = {}
    for line in raw:
        match = SUBJECT_RE.match(line)
        if not match:
            raise ValueError(f"Unparseable subject entry: {line!r}")
        meta = match.groupdict()
        subjects[meta["abbr"]] = {
            "name": meta["name"],
            "hours": int(meta["hours"]),
            "is_lab": meta["is_lab"] == "True",
            "code": meta["code"],
        }
    return subjects


def parse_assignments(raw: dict[str, list[str]]) -> dict[str, dict[str, list[str]]]:
    """Per section: {abbr: [faculty, ...]} from "Name - ABBR - Faculty" strings."""
    assignments: dict[str, dict[str, list[str]]] = {}
    for section, lines in raw.items():
        per_subject: dict[str, list[str]] = {}
        for line in lines:
            _, abbr, faculty = (part.strip() for part in line.rsplit(" - ", 2))
            per_subject[abbr] = [name.strip() for name in faculty.split(",")]
        assignments[section] = per_subject
    return assignments


def grid_facts(
    grid: dict[str, dict[str, str]],
) -> tuple[dict[str, int], dict[str, list[int]], list[tuple[str, int]]]:
    """One section's fixed grid -> (hours per abbr, blocked slots per day, pinned cells).

    Slots are returned 1-indexed; pinned cells are (day, slot) per non-"-" label.
    """
    hours: dict[str, int] = {}
    blocked: dict[str, list[int]] = {}
    pins: list[tuple[str, str, int]] = []
    for day_index, slots in grid.items():
        day = DAYS[int(day_index)]
        for slot_index, label in slots.items():
            slot = int(slot_index) + 1
            if label == "-":
                blocked.setdefault(day, []).append(slot)
            else:
                hours[label] = hours.get(label, 0) + 1
                pins.append((label, day, slot))
    return hours, {day: sorted(slots) for day, slots in blocked.items()}, pins


def build_problem(data: list[Any]) -> dict[str, Any]:
    """Assemble the ChronoSolve problem mapping from the legacy blob."""
    subjects_meta = parse_subjects(data[6][SEMESTER])
    assignments = parse_assignments(data[9][SEMESTER])
    sections = sorted(data[8][SEMESTER])
    grids = data[11][SEMESTER]

    teachers: dict[str, str] = {}
    subjects: list[dict[str, Any]] = []
    groups: list[dict[str, Any]] = []
    pre_assignments: list[dict[str, Any]] = []

    for section in sections:
        grid_hours, blocked, pins = grid_facts(grids[section])
        groups.append(
            {
                "id": f"sec_{section.lower()}",
                "name": f"CSE III Sem - Section {section}",
                "size": 60,
                "unavailable": blocked,
            }
        )
        for abbr, faculty in assignments[section].items():
            meta = subjects_meta[abbr]
            for name in faculty:
                teachers.setdefault(slug(name), name)
            subject: dict[str, Any] = {
                "id": f"{abbr_slug(abbr)}-{section}",
                "name": meta["name"],
                "hours_per_week": meta["hours"] or grid_hours.get(abbr, 0),
                "teacher_ids": [slug(name) for name in faculty],
                "group_ids": [f"sec_{section.lower()}"],
            }
            if meta["is_lab"]:
                subject["type"] = "lab"
                subject["consecutive_hours"] = 3
                subject["preferred_room_type"] = "lab"
            subjects.append(subject)
        if section == "A":
            pre_assignments = [
                {"subject_id": f"{abbr_slug(abbr)}-A", "day": day, "slot": slot}
                for abbr, day, slot in pins
                if abbr == "Maths"
            ]

    rooms = [
        {"id": f"lh_{n}", "name": f"Lecture Hall {n}", "capacity": 70, "type": "lecture"}
        for n in range(1, 5)
    ] + [
        {"id": f"cs_lab_{n}", "name": f"CS Lab {n}", "capacity": 70, "type": "lab"} for n in (1, 2)
    ]

    return {
        "time_structure": {"days": DAYS, "slots_per_day": 8},
        "teachers": [{"id": tid, "name": name} for tid, name in sorted(teachers.items())],
        "student_groups": groups,
        "subjects": subjects,
        "rooms": rooms,
        "pre_assignments": pre_assignments,
        "constraints": {"soft": {"minimize_student_gaps": 60, "spread_subjects": 40}},
    }


def write_csvs(problem: dict[str, Any], data: list[Any], out_dir: Path) -> None:
    """Flatten the same data into legacy-shaped CSVs for the import wizard."""
    out_dir.mkdir(parents=True, exist_ok=True)
    subjects_meta = parse_subjects(data[6][SEMESTER])
    assignments = parse_assignments(data[9][SEMESTER])

    with (out_dir / "courses.csv").open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            [
                "Course_ID",
                "Course_Title",
                "Abbrev",
                "Hours_Per_Week",
                "Is_Lab",
                "Instructor_Name",
                "Section",
            ]
        )
        for subject in problem["subjects"]:
            slugged, section = subject["id"].rsplit("-", 1)
            abbr = next(a for a in assignments[section] if abbr_slug(a) == slugged)
            meta = subjects_meta[abbr]
            names = ", ".join(assignments[section][abbr])
            writer.writerow(
                [
                    subject["id"],
                    subject["name"],
                    abbr,
                    subject["hours_per_week"],
                    meta["is_lab"],
                    names,
                    subject["group_ids"][0],  # group id, so imports link up
                ]
            )

    with (out_dir / "professors.csv").open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Instructor_Name", "Department"])
        for teacher in problem["teachers"]:
            writer.writerow([teacher["name"], "Computer Science & Engineering"])

    with (out_dir / "groups.csv").open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Section", "Section_Name", "Strength"])
        for group in problem["student_groups"]:
            writer.writerow([group["id"], group["name"], group["size"]])

    with (out_dir / "rooms.csv").open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Room_ID", "Room_Name", "Capacity", "Room_Type"])
        for room in problem["rooms"]:
            writer.writerow([room["id"], room["name"], room["capacity"], room["type"]])


def main() -> None:
    """Convert the legacy blob and write the example YAML + CSV fixtures."""
    legacy_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_LEGACY
    data = json.loads(legacy_path.read_text())
    problem = build_problem(data)

    yaml_path = REPO_ROOT / "examples" / "nmamit_cse_sem3.yaml"
    yaml_path.parent.mkdir(parents=True, exist_ok=True)
    body = yaml.dump(problem, sort_keys=False, allow_unicode=True, width=100)
    yaml_path.write_text(f"{YAML_HEADER}\n{body}")
    write_csvs(problem, data, REPO_ROOT / "examples" / "import")
    print(f"Wrote {yaml_path.relative_to(REPO_ROOT)} and examples/import/*.csv")


if __name__ == "__main__":
    main()
