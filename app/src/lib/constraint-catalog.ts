/** Plain-language copy that replaces the solver's snake_case keys on the
    Constraints route. `scored` marks the 6 soft constraints /score reports a
    satisfaction metric for - the only ones that get a post-solve impact line.
    `metricKey` is that constraint's key inside QualityReport.metrics, which
    scoring/quality.py keys by short metric name (e.g. "student_gaps"), not by
    the soft-constraint config key - so the impact lookup must use metricKey. */

export interface HardConstraintDef {
  key: string;
  label: string;
  description: string;
  /** Clash/coverage rules: turning these off lets the solver break them. */
  caution: boolean;
}

export interface SoftConstraintDef {
  key: string;
  label: string;
  description: string;
  scored: boolean;
  /** Key inside QualityReport.metrics; set only for scored constraints. */
  metricKey?: string;
}

export const HARD_CONSTRAINTS: HardConstraintDef[] = [
  {
    key: "teacher_no_clash",
    label: "No teacher double-booked",
    description: "A teacher is never scheduled for two classes at once.",
    caution: true,
  },
  {
    key: "group_no_clash",
    label: "No class double-booked",
    description: "A student group is never in two places at once.",
    caution: true,
  },
  {
    key: "room_no_clash",
    label: "No room double-booked",
    description: "A room hosts at most one class per slot.",
    caution: true,
  },
  {
    key: "respect_availability",
    label: "Honor unavailable times",
    description: "Never schedule during a teacher's or group's marked-off time.",
    caution: false,
  },
  {
    key: "required_hours",
    label: "Schedule every required hour",
    description: "Each subject gets exactly its weekly hours.",
    caution: true,
  },
];

export const SOFT_CONSTRAINTS: SoftConstraintDef[] = [
  {
    key: "minimize_student_gaps",
    label: "No gaps for students",
    description: "Avoid free periods between a class's lessons.",
    scored: true,
    metricKey: "student_gaps",
  },
  {
    key: "minimize_teacher_gaps",
    label: "No gaps for teachers",
    description: "Keep each teacher's day compact.",
    scored: true,
    metricKey: "teacher_gaps",
  },
  {
    key: "spread_subjects",
    label: "Spread subjects across the week",
    description: "Avoid clustering a subject onto one or two days.",
    scored: true,
    metricKey: "subject_spread",
  },
  {
    key: "teacher_time_preferences",
    label: "Honor teacher time preferences",
    description: "Favor the slots teachers prefer to teach.",
    scored: true,
    metricKey: "teacher_preferences",
  },
  {
    key: "compact_schedules",
    label: "Compact days",
    description: "Pack each day's classes together with fewer holes.",
    scored: true,
    metricKey: "compactness",
  },
  {
    key: "workload_balance",
    label: "Even teacher workload",
    description: "Spread teaching hours evenly across teachers and days.",
    scored: true,
    metricKey: "workload_balance",
  },
  {
    key: "avoid_consecutive_hours",
    label: "Avoid back-to-back hours",
    description: "Discourage long unbroken runs of the same class.",
    scored: false,
  },
  {
    key: "leave_early",
    label: "Finish the day earlier",
    description: "Favor earlier finish times where possible.",
    scored: false,
  },
  {
    key: "max_hours_per_day",
    label: "Cap daily teaching load",
    description: "Discourage overloading any single day.",
    scored: false,
  },
  {
    key: "free_days",
    label: "Give free days",
    description: "Try to leave teachers and groups a clear day.",
    scored: false,
  },
];
