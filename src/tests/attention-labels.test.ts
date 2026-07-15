import { describe, expect, it } from "vitest";
import {
  attentionReasonsFromLabels,
  normalizeAttentionSignalCandidates,
  publicStudentLabels,
} from "@/lib/attention-labels";

describe("internal attention labels", () => {
  it("normalizes controlled candidates and keeps the highest confidence per reason", () => {
    expect(normalizeAttentionSignalCandidates([
      { reason: "academic-performance", confidence: "low", evidenceSummary: "成绩差" },
      { reason: "academic-performance", confidence: "high", evidenceSummary: "明确表示跟不上" },
      { reason: "unknown", confidence: "high", evidenceSummary: "忽略" },
    ])).toEqual([{ reason: "academic-performance", confidence: "high", evidenceSummary: "明确表示跟不上" }]);
  });

  it("filters internal labels from parent-facing contexts while retaining public labels", () => {
    const labels = ["踏实", "AI内部关注：成绩表现", "AI内部关注：家长担心"];
    expect(publicStudentLabels(labels)).toEqual(["踏实"]);
    expect(attentionReasonsFromLabels(labels)).toEqual(["academic-performance", "parent-concern"]);
  });
});
