import { ALERT_RULES, calculateStudentAlertCutoffs } from "@/config/rules";
import type { AttentionReason } from "@/lib/attention-labels";

export type StudentRiskSignalType =
  | "early-relative-performance"
  | "sustained-decline"
  | "persistent-below-average"
  | "qualitative-feedback";

export interface StudentRiskSignal {
  type: StudentRiskSignalType;
  label: string;
  evidence: string;
}

export interface StudentRisk {
  studentId: string;
  studentName: string;
  className: string;
  level: "attention" | "warning";
  signals: StudentRiskSignal[];
  qualitativeReasons: AttentionReason[];
  lastActivityAt: string;
}

export interface RiskMetricPoint {
  sessionId: string;
  composite: number;
  classAverage: number | null;
}

export function compositeScore(metric: { scoreA: number; scoreB: number; scoreC: number }) {
  return +((metric.scoreA + metric.scoreB + metric.scoreC) / 3).toFixed(2);
}

export function usesEarlyRelativePerformance(occurredSessionCount: number) {
  return occurredSessionCount <= ALERT_RULES.studentRisk.earlySessionLimit;
}

export function sustainedDeclineSignal(points: RiskMetricPoint[]): StudentRiskSignal | null {
  const latest = points.slice(-ALERT_RULES.studentRisk.sustainedTrendPoints);
  if (latest.length < ALERT_RULES.studentRisk.sustainedTrendPoints) return null;
  const continuouslyLower = latest.every((point, index) => index === 0 || point.composite < latest[index - 1].composite);
  const decline = +(latest[0].composite - latest[latest.length - 1].composite).toFixed(1);
  if (!continuouslyLower || decline < ALERT_RULES.studentRisk.minimumTrendDecline) return null;
  return { type: "sustained-decline", label: "持续状态回落", evidence: `最近三次综合表现连续下降，累计下降 ${decline} 分` };
}

export function persistentBelowAverageSignal(points: RiskMetricPoint[], occurredSessionCount: number): StudentRiskSignal | null {
  if (occurredSessionCount <= 0 || points.length / occurredSessionCount < ALERT_RULES.studentRisk.minimumCoverageFraction) return null;
  const comparable = points.filter((point) => point.classAverage !== null);
  if (comparable.length === 0) return null;
  const deviations = comparable.map((point) => point.composite - (point.classAverage ?? point.composite));
  const belowCount = deviations.filter((deviation) => deviation < 0).length;
  const belowFraction = belowCount / comparable.length;
  const averageDeviation = +(deviations.reduce((sum, deviation) => sum + deviation, 0) / deviations.length).toFixed(1);
  if (belowFraction < ALERT_RULES.studentRisk.minimumBelowAverageFraction || averageDeviation > -ALERT_RULES.studentRisk.minimumAverageGap) return null;
  return {
    type: "persistent-below-average",
    label: "长期低于同期班均",
    evidence: `${belowCount}/${comparable.length} 次低于同期班均，平均相差 ${Math.abs(averageDeviation)} 分`,
  };
}

export function earlyRelativeStudentIds(entries: Array<{ studentId: string; averageDeviation: number }>) {
  if (entries.length < ALERT_RULES.studentRanking.minimumStudents) return new Set<string>();
  const ranked = [...entries].sort((left, right) => left.averageDeviation - right.averageDeviation);
  const { yellow } = calculateStudentAlertCutoffs(ranked.length);
  const base = Math.min(yellow, ranked.length);
  const maximum = Math.min(ranked.length, Math.ceil(base * ALERT_RULES.studentRanking.tieExpansionMultiplier));
  const boundary = ranked[base - 1].averageDeviation;
  let end = base;
  while (end < maximum && ranked[end].averageDeviation === boundary) end += 1;
  return new Set(ranked.slice(0, end).filter((entry) => entry.averageDeviation < 0).map((entry) => entry.studentId));
}

export function classifyStudentRisk(input: Omit<StudentRisk, "level">): StudentRisk | null {
  if (input.signals.length === 0) return null;
  return { ...input, level: input.signals.length >= 2 ? "warning" : "attention" };
}
