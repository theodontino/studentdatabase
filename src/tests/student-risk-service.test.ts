import { describe, expect, it } from "vitest";
import {
  classifyStudentRisk,
  earlyRelativeStudentIds,
  persistentBelowAverageSignal,
  sustainedDeclineSignal,
  type RiskMetricPoint,
} from "@/services/student-risk-service";

function point(composite: number, classAverage: number | null = 3.5, index = 0): RiskMetricPoint {
  return { sessionId: `session-${index}`, composite, classAverage };
}

describe("student risk rules", () => {
  it("keeps early ranking as one signal bucket and expands boundary ties", () => {
    const ids = earlyRelativeStudentIds([
      { studentId: "a", averageDeviation: -1 },
      { studentId: "b", averageDeviation: -0.5 },
      { studentId: "c", averageDeviation: -0.5 },
      { studentId: "d", averageDeviation: 0.4 },
      { studentId: "e", averageDeviation: 0.6 },
    ]);
    expect(ids).toEqual(new Set(["a", "b", "c"]));
  });

  it("requires three continuously declining points and a total half-point drop", () => {
    expect(sustainedDeclineSignal([point(4, 4, 1), point(3.8, 4, 2), point(3.4, 4, 3)])).toMatchObject({ type: "sustained-decline" });
    expect(sustainedDeclineSignal([point(4, 4, 1), point(3.4, 4, 2), point(3.8, 4, 3)])).toBeNull();
    expect(sustainedDeclineSignal([point(4, 4, 1), point(3.9, 4, 2)])).toBeNull();
  });

  it("requires coverage, repeated below-average results, and a meaningful average gap", () => {
    const points = [point(2.5, 3.2, 1), point(2.8, 3.4, 2), point(3, 3.7, 3)];
    expect(persistentBelowAverageSignal(points, 5)).toMatchObject({ type: "persistent-below-average" });
    expect(persistentBelowAverageSignal(points.slice(0, 2), 5)).toBeNull();
    expect(persistentBelowAverageSignal([point(3.1, 3.2, 1), point(3.4, 3.5, 2), point(3.5, 3.6, 3)], 5)).toBeNull();
  });

  it("uses signal count for attention and warning regardless of qualitative reason count", () => {
    const qualitative = { type: "qualitative-feedback" as const, label: "定性反馈关注", evidence: "成绩表现、学习信心" };
    const attention = classifyStudentRisk({ studentId: "a", studentName: "测试学生", className: "测试班", signals: [qualitative], qualitativeReasons: ["academic-performance", "learning-confidence"], lastActivityAt: "2026-07-15" });
    const warning = classifyStudentRisk({ studentId: "a", studentName: "测试学生", className: "测试班", signals: [qualitative, { type: "sustained-decline", label: "持续状态回落", evidence: "下降" }], qualitativeReasons: ["academic-performance", "learning-confidence"], lastActivityAt: "2026-07-15" });
    expect(attention?.level).toBe("attention");
    expect(warning?.level).toBe("warning");
  });
});
