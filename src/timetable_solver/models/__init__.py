"""Pydantic data models for timetable scheduling."""

from timetable_solver.models.constraints import ConstraintsConfig, HardConstraints, SoftConstraints
from timetable_solver.models.pre_assignment import PreAssignment
from timetable_solver.models.problem import TimetableProblem
from timetable_solver.models.room import Room, RoomType
from timetable_solver.models.rules import (
    AdvancedConstraints,
    GlobalBreak,
    GroupFreeHalfDay,
    RoomReservation,
    SubjectPair,
)
from timetable_solver.models.schedule import ScheduleEntry, SolveResult, SolverStatus
from timetable_solver.models.student_group import StudentGroup
from timetable_solver.models.subject import Subject, SubjectType
from timetable_solver.models.teacher import Teacher, TeacherPreferences
from timetable_solver.models.time_structure import TimeStructure

__all__ = [
    "AdvancedConstraints",
    "ConstraintsConfig",
    "GlobalBreak",
    "GroupFreeHalfDay",
    "HardConstraints",
    "PreAssignment",
    "Room",
    "RoomReservation",
    "RoomType",
    "SubjectPair",
    "ScheduleEntry",
    "SoftConstraints",
    "SolveResult",
    "SolverStatus",
    "StudentGroup",
    "Subject",
    "SubjectType",
    "Teacher",
    "TeacherPreferences",
    "TimeStructure",
    "TimetableProblem",
]
