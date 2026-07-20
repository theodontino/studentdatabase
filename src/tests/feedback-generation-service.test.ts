import { describe, expect, it, vi } from "vitest";
import {
  generateReviewedFeedback,
  reviewFeedbackDraft,
} from "@/services/feedback-generation-service";

function clientWith(...contents: string[]) {
  const create = vi.fn();
  for (const content of contents) {
    create.mockResolvedValueOnce({ choices: [{ message: { content } }] });
  }
  return { client: { chat: { completions: { create } } } as any, create };
}

describe("feedback generation review", () => {
  it("keeps an approved draft unchanged", async () => {
    const draft = clientWith("本节课学习投入，订正较认真，建议继续保持。 ");
    const review = clientWith(JSON.stringify({ verdict: "pass", feedback: "不应替换原稿", issues: [] }));

    const result = await generateReviewedFeedback({
      studentName: "学生甲",
      promptContext: "学生甲本节课主动订正错题。",
      lengthRequirement: "50-80字",
      draftClient: draft.client,
      draftModel: "draft-model",
      reviewClient: review.client,
      reviewModel: "review-model",
    });

    expect(result).toMatchObject({
      draftFeedback: "本节课学习投入，订正较认真，建议继续保持。",
      feedback: "本节课学习投入，订正较认真，建议继续保持。",
      reviewStatus: "passed",
      reviewIssues: [],
    });
    expect(draft.create).toHaveBeenCalledWith(expect.objectContaining({ model: "draft-model", temperature: 0.5 }));
    expect(review.create).toHaveBeenCalledWith(expect.objectContaining({ model: "review-model", temperature: 0 }));
  });

  it("uses a supported revision and retains the original draft", async () => {
    const result = await reviewFeedbackDraft({
      studentName: "学生甲",
      promptContext: "学生甲本节课主动订正错题。",
      lengthRequirement: "50-80字",
      draftFeedback: "学生甲成绩已经大幅提升。",
      client: clientWith(JSON.stringify({
        verdict: "revise",
        feedback: "本节课能够主动订正错题，建议继续保持认真复盘的习惯。",
        issues: ["原稿包含背景未支持的成绩结论"],
      })).client,
      model: "review-model",
    });

    expect(result).toMatchObject({
      draftFeedback: "学生甲成绩已经大幅提升。",
      feedback: "本节课能够主动订正错题，建议继续保持认真复盘的习惯。",
      reviewStatus: "revised",
      reviewIssues: ["原稿包含背景未支持的成绩结论"],
    });
  });

  it("requires manual review after malformed reviewer output", async () => {
    const review = clientWith("not-json", "still-not-json");
    const result = await reviewFeedbackDraft({
      studentName: "学生甲",
      promptContext: "本节课无明确表现记录。",
      lengthRequirement: "50-80字",
      draftFeedback: "今天表现很好。",
      client: review.client,
      model: "review-model",
    });

    expect(result.reviewStatus).toBe("needs_review");
    expect(result.feedback).toBe("今天表现很好。");
    expect(result.reviewIssues[0]).toContain("连续两次");
    expect(review.create).toHaveBeenCalledTimes(2);
  });

  it("does not approve text mentioning another student", async () => {
    const review = clientWith(JSON.stringify({ verdict: "pass", feedback: "", issues: [] }));
    const result = await reviewFeedbackDraft({
      studentName: "学生甲",
      promptContext: "学生甲本节课完成练习。",
      forbiddenStudentNames: ["学生乙"],
      lengthRequirement: "50-80字",
      draftFeedback: "学生甲比学生乙完成得更好。",
      client: review.client,
      model: "review-model",
    });

    expect(result.reviewStatus).toBe("needs_review");
    expect(result.reviewIssues).toContain("反馈中出现了其他学生姓名");
  });
});
