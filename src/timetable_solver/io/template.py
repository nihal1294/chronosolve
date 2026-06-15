"""Commented example input template served by the CLI and the API."""

import json

import yaml

TEMPLATE_YAML = """\
# ChronoSolve timetable problem template.
# Every institution-specific detail is configurable - adjust freely.

time_structure:
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  slots_per_day: 6
  # slot_overrides: { Saturday: 4 }     # days with fewer slots
  slot_labels:                          # optional display labels
    1: "9:00 - 9:55"
    2: "10:00 - 10:55"

teachers:
  - id: t_smith
    name: Dr. Smith
    unavailable:                        # HARD: never schedule here
      Friday: [5, 6]
    preferences:                        # SOFT: optimized via weights below
      slot_preferences:
        Monday: { 1: preferred, 6: avoid }
      max_hours_per_day: 4
      min_free_days: 1
      schedule_style: compact           # compact | spread
      consecutive_hours: avoid          # avoid | prefer
      leave_early:
        Wednesday: 4                    # prefer no classes after slot 4

student_groups:
  - id: sec_a
    name: Section A
    size: 40
    department: CSE                      # optional labels, only used to
    semester: 3                          # group and filter timetable views

rooms:                                  # optional - omit to skip room constraints
  - id: r101
    name: Room 101
    capacity: 50
    type: lecture                       # lecture | lab | any

subjects:
  - id: math
    name: Mathematics
    hours_per_week: 4
    teacher_ids: [t_smith]
    group_ids: [sec_a]
    max_per_day: 1                      # sessions per day
    preferred_room_type: lecture
  - id: sci_lab
    name: Science Lab
    hours_per_week: 2
    type: lab
    teacher_ids: [t_smith]
    group_ids: [sec_a]
    consecutive_hours: 2                # must run as a contiguous block

pre_assignments:                        # optional fixed slots
  - subject_id: math
    day: Monday
    slot: 1

constraints:
  hard:                                 # all default to true
    teacher_no_clash: true
    group_no_clash: true
    room_no_clash: true
    respect_availability: true
    required_hours: true
  soft:                                 # 0 = off, 1-100 = priority
    minimize_student_gaps: 80
    minimize_teacher_gaps: 40
    spread_subjects: 50
    teacher_time_preferences: 60
    compact_schedules: 40
    avoid_consecutive_hours: 20
    leave_early: 30
    max_hours_per_day: 50
    free_days: 40
    workload_balance: 30
"""


def get_template(fmt: str = "yaml") -> str:
    """Return the example input template.

    Args:
        fmt: "yaml" (commented) or "json" (comments stripped by conversion).

    Returns:
        Template text in the requested format.
    """
    if fmt == "json":
        return json.dumps(yaml.safe_load(TEMPLATE_YAML), indent=2)
    return TEMPLATE_YAML
