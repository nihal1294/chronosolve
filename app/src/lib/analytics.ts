/** Derivations behind the Analytics & Export view's KPI cards and the
    soft-constraint penalty breakdown (MetricsReportingTab spec). */

import type { QualityReport, ScheduleEntry } from "./solver-client";

/** Percent of room-slots occupied, or null when there are no rooms/slots. */
export function roomUtilization(
  schedule: ScheduleEntry[],
  roomCount: number,
  dayCount: number,
  slotsPerDay: number,
): number | null {
  const capacity = roomCount * dayCount * slotsPerDay;
  if (capacity === 0) return null;
  const occupied = new Set(
    schedule
      .filter((entry) => entry.room_id !== null)
      .map((entry) => `${entry.room_id}|${entry.day}|${entry.slot}`),
  );
  return (occupied.size / capacity) * 100;
}

export interface PenaltyShare {
  label: string;
  /** Whole-number percent of the total penalty this metric contributes. */
  share: number;
}

/** Each metric scores 0-100; its penalty is the gap to 100. Shares are the
    penalties normalized across metrics, largest first, perfect metrics
    dropped. Empty when nothing is penalized. */
export function penaltyShares(report: QualityReport): PenaltyShare[] {
  const penalties = Object.entries(report.metrics)
    .map(([name, score]) => ({ name, penalty: Math.max(0, 100 - score) }))
    .filter((item) => item.penalty > 0);
  const total = penalties.reduce((sum, item) => sum + item.penalty, 0);
  if (total === 0) return [];
  return penalties
    .sort((a, b) => b.penalty - a.penalty)
    .map((item) => ({ label: humanizeMetric(item.name), share: Math.round((item.penalty / total) * 100) }));
}

/** M7.4 advanced-metric keys mapped to the app's rule vocabulary (softened
    kinds reuse the InfeasibilityPanel names). Unknown keys fall back to the
    generic humanizer below. */
const METRIC_LABELS: Record<string, string> = {
  group_balance: "Group workload balance",
  lab_adjacency: "Back-to-back labs",
  free_halfday: "Free half-days",
  room_stability: "Same room all week",
  softened_breaks: "Scheduled break (preference)",
  softened_allowed_slots: "Allowed slots (preference)",
  softened_teacher_caps: "Daily teaching cap (preference)",
  softened_same_day: "Different days (preference)",
  softened_orderings: "Running order (preference)",
};

/** "minimize_student_gaps" -> "Minimize Student Gaps". */
export function humanizeMetric(name: string): string {
  const mapped = METRIC_LABELS[name];
  if (mapped) return mapped;
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Each metric's share of the total penalty (gap to 100), keyed by metric name.
    Satisfied metrics map to 0; an all-satisfied report maps every key to 0.
    Shares are rounded independently and may not sum to exactly 100 (largest-
    remainder); each value is only used for its own bar width, never summed. */
export function impactShares(metrics: Record<string, number>): Record<string, number> {
  const penalties: Record<string, number> = {};
  let total = 0;
  for (const [name, score] of Object.entries(metrics)) {
    const penalty = Math.max(0, 100 - score);
    penalties[name] = penalty;
    total += penalty;
  }
  const shares: Record<string, number> = {};
  for (const name of Object.keys(metrics)) {
    shares[name] = total === 0 ? 0 : Math.round((penalties[name] / total) * 100);
  }
  return shares;
}
