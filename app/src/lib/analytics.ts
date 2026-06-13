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

/** "minimize_student_gaps" -> "Minimize Student Gaps". */
export function humanizeMetric(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
