/** Presentation-only mapping over the stored 0-100 soft-constraint weight: end
    users pick an importance band, the solver still reads the raw number. */

export interface ImportanceBand {
  label: string;
  weight: number;
}

/** Five bands, ascending; index 0 is lowest. The meter renders one segment per band. */
export const IMPORTANCE_BANDS: ImportanceBand[] = [
  { label: "Ignore", weight: 0 },
  { label: "Minor", weight: 25 },
  { label: "Moderate", weight: 50 },
  { label: "Strong", weight: 75 },
  { label: "Must-try", weight: 100 },
];

/** Index (0-4) of the band nearest a stored weight; ties keep the lower index. */
export function weightToImportance(weight: number): number {
  let best = 0;
  let bestDist = Infinity;
  IMPORTANCE_BANDS.forEach((band, index) => {
    const dist = Math.abs(band.weight - weight);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

/** Canonical weight for a band index (clamped to a valid index). */
export function importanceToWeight(index: number): number {
  const clamped = Math.max(0, Math.min(IMPORTANCE_BANDS.length - 1, index));
  return IMPORTANCE_BANDS[clamped].weight;
}

/** Band label for a stored weight (e.g. 75 -> "Strong", 60 -> "Strong"). */
export function bandLabel(weight: number): string {
  return IMPORTANCE_BANDS[weightToImportance(weight)].label;
}

export type PresetName = "Balanced" | "Student-first" | "Teacher-first" | "Tight schedule";

export const PRESET_NAMES: PresetName[] = ["Balanced", "Student-first", "Teacher-first", "Tight schedule"];

/** Each preset maps every soft-constraint key to a canonical band weight. */
export const PRESETS: Record<PresetName, Record<string, number>> = {
  Balanced: {
    minimize_student_gaps: 50,
    minimize_teacher_gaps: 50,
    spread_subjects: 50,
    teacher_time_preferences: 50,
    compact_schedules: 50,
    workload_balance: 75,
    avoid_consecutive_hours: 25,
    leave_early: 25,
    max_hours_per_day: 25,
    free_days: 25,
  },
  "Student-first": {
    minimize_student_gaps: 100,
    minimize_teacher_gaps: 25,
    spread_subjects: 75,
    teacher_time_preferences: 25,
    compact_schedules: 75,
    workload_balance: 50,
    avoid_consecutive_hours: 25,
    leave_early: 0,
    max_hours_per_day: 50,
    free_days: 50,
  },
  "Teacher-first": {
    minimize_student_gaps: 25,
    minimize_teacher_gaps: 75,
    spread_subjects: 25,
    teacher_time_preferences: 100,
    compact_schedules: 25,
    workload_balance: 75,
    avoid_consecutive_hours: 50,
    leave_early: 75,
    max_hours_per_day: 25,
    free_days: 50,
  },
  "Tight schedule": {
    minimize_student_gaps: 75,
    minimize_teacher_gaps: 75,
    spread_subjects: 0,
    teacher_time_preferences: 25,
    compact_schedules: 100,
    workload_balance: 50,
    avoid_consecutive_hours: 0,
    leave_early: 25,
    max_hours_per_day: 75,
    free_days: 0,
  },
};
