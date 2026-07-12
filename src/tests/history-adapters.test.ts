import { describe, expect, it } from "vitest";
import { isLegacyFeedbackState } from "@/features/feedback/history-adapters";
import { isDailyHistoryState } from "@/features/reports/history-adapters";

describe("v0.17 history adapters", () => {
  it("routes old report states to the correct workspace", () => {
    expect(isDailyHistoryState({ kind: "daily" })).toBe(true);
    expect(isLegacyFeedbackState({ kind: "batch" })).toBe(true);
    expect(isLegacyFeedbackState({ kind: "single" })).toBe(true);
    expect(isLegacyFeedbackState({ kind: "daily" })).toBe(false);
  });
});
