import { describe, expect, it } from "vitest";
import { isInputHistoryState, isLegacyFeedbackState } from "@/features/feedback/history-adapters";
import { isDailyHistoryState } from "@/features/reports/history-adapters";

describe("v0.17 history adapters", () => {
  it("routes old report states to the correct workspace", () => {
    expect(isDailyHistoryState({ kind: "daily" })).toBe(true);
    expect(isLegacyFeedbackState({ kind: "batch" })).toBe(true);
    expect(isLegacyFeedbackState({ kind: "single" })).toBe(true);
    expect(isLegacyFeedbackState({ kind: "daily" })).toBe(false);
  });

  it("accepts old natural-language input history without weakening feedback guards", () => {
    expect(isInputHistoryState({
      rawText: "课堂回顾",
      semesterId: "sem-1",
      className: "一班",
      sessionCode: "S01",
      result: { draftId: "draft-1", rawText: "课堂回顾", parsedResult: { students: [], alert_suggestion: "" }, reviewResult: null },
    })).toBe(true);
    expect(isInputHistoryState({ kind: "batch" })).toBe(false);
  });
});
