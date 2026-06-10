"""Quality scoring and statistics for timetable schedules."""

from timetable_solver.scoring.quality import QualityReport, score_schedule
from timetable_solver.scoring.statistics import ScheduleStatistics, compute_statistics
from timetable_solver.scoring.violations import find_hard_violations

__all__ = [
    "QualityReport",
    "ScheduleStatistics",
    "compute_statistics",
    "find_hard_violations",
    "score_schedule",
]
