import { describe, expect, it } from "vitest";
import { entryReducer, INITIAL_ENTRY_STATE } from "@/features/entry/entry-reducer";

describe("entry reducer", () => {
  it("keeps the workflow alive while moving from input to review and save", () => {
    const validating = entryReducer(INITIAL_ENTRY_STATE, {
      type: "workflow",
      action: { type: "start", operation: "解析课堂记录", now: "2026-07-15T00:00:00.000Z" },
    });
    const generating = entryReducer(validating, { type: "workflow", action: { type: "transition", phase: "generating" } });
    const reviewing = entryReducer(generating, { type: "workflow", action: { type: "transition", phase: "reviewing" } });
    const reviewStep = entryReducer(reviewing, { type: "set-step", step: "review" });
    const saving = entryReducer(reviewStep, { type: "workflow", action: { type: "transition", phase: "saving" } });
    const completed = entryReducer(saving, { type: "workflow", action: { type: "transition", phase: "completed" } });

    expect(reviewStep).toMatchObject({ step: "review", workflow: { phase: "reviewing" } });
    expect(completed).toMatchObject({ step: "review", workflow: { phase: "completed", operation: "解析课堂记录" } });
  });

  it("does not discard workflow state when selecting the current tab", () => {
    const state = entryReducer(INITIAL_ENTRY_STATE, {
      type: "workflow",
      action: { type: "start", operation: "任务", now: "2026-07-15T00:00:00.000Z" },
    });
    expect(entryReducer(state, { type: "set-step", step: "input" })).toBe(state);
  });
});
