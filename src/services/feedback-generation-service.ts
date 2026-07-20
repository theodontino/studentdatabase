import type { createLLMClient } from "@/lib/llm";

const FEEDBACK_MAX_TOKENS = 2048;
const FEEDBACK_MAX_ATTEMPTS = 2;

type LLMClient = ReturnType<typeof createLLMClient>;

export type FeedbackReviewStatus = "passed" | "revised" | "needs_review" | "edited";

export interface ReviewedFeedback {
  draftFeedback: string;
  feedback: string;
  reviewStatus: Exclude<FeedbackReviewStatus, "edited">;
  reviewIssues: string[];
}

interface FeedbackDraftInput {
  studentName: string;
  promptContext: string;
  lengthRequirement: string;
  client: LLMClient;
  model: string;
}

interface FeedbackReviewInput extends FeedbackDraftInput {
  draftFeedback: string;
  forbiddenStudentNames?: string[];
}

interface GenerateReviewedFeedbackInput {
  studentName: string;
  promptContext: string;
  forbiddenStudentNames?: string[];
  lengthRequirement: string;
  draftClient: LLMClient;
  draftModel: string;
  reviewClient: LLMClient;
  reviewModel: string;
}

interface ReviewPayload {
  verdict?: unknown;
  feedback?: unknown;
  issues?: unknown;
}

function cleanJsonText(value: string) {
  let text = value.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```\w*\n?/, "").replace(/\n?```$/, "").trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

function parseReviewPayload(value: string): ReviewPayload {
  const parsed = JSON.parse(cleanJsonText(value));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("审核模型未返回 JSON 对象");
  }
  return parsed as ReviewPayload;
}

function normalizeIssues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => {
    if (typeof item === "string") return item.trim();
    if (item && typeof item === "object" && "message" in item && typeof item.message === "string") {
      return item.message.trim();
    }
    return "";
  }).filter(Boolean))].slice(0, 8);
}

function normalizeVerdict(value: unknown) {
  const verdict = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["pass", "passed", "通过"].includes(verdict)) return "passed" as const;
  if (["revise", "revised", "修订", "已修订"].includes(verdict)) return "revised" as const;
  return "needs_review" as const;
}

function isJsonModeUnsupported(error: unknown) {
  const candidate = error as { status?: number; message?: string };
  return [400, 404, 422].includes(candidate?.status ?? 0)
    && /response[_ -]?format|json[_ -]?object|json mode/i.test(candidate?.message || "");
}

async function createReviewCompletion(client: LLMClient, model: string, prompt: string) {
  const request = {
    model,
    messages: [{ role: "user" as const, content: prompt }],
    temperature: 0,
    max_tokens: FEEDBACK_MAX_TOKENS,
  };
  try {
    return await client.chat.completions.create({
      ...request,
      response_format: { type: "json_object" },
    });
  } catch (error) {
    if (!isJsonModeUnsupported(error)) throw error;
    return client.chat.completions.create(request);
  }
}

async function generateDraft(client: LLMClient, model: string, prompt: string) {
  for (let attempt = 1; attempt <= FEEDBACK_MAX_ATTEMPTS; attempt += 1) {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: FEEDBACK_MAX_TOKENS,
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (content) return content;
  }
  throw new Error("LLM 返回空反馈内容，请重试");
}

async function reviewDraft(client: LLMClient, model: string, prompt: string) {
  for (let attempt = 1; attempt <= FEEDBACK_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await createReviewCompletion(client, model, prompt);
      const content = response.choices[0]?.message?.content?.trim();
      if (content) return parseReviewPayload(content);
    } catch {
      // Retry once with the same evidence and stricter temperature before requiring manual review.
    }
  }
  return null;
}

export async function generateReviewedFeedback(
  input: GenerateReviewedFeedbackInput,
): Promise<ReviewedFeedback> {
  const draftFeedback = await generateFeedbackDraft({
    studentName: input.studentName,
    promptContext: input.promptContext,
    lengthRequirement: input.lengthRequirement,
    client: input.draftClient,
    model: input.draftModel,
  });
  return reviewFeedbackDraft({
    studentName: input.studentName,
    promptContext: input.promptContext,
    forbiddenStudentNames: input.forbiddenStudentNames,
    lengthRequirement: input.lengthRequirement,
    draftFeedback,
    client: input.reviewClient,
    model: input.reviewModel,
  });
}

export async function generateFeedbackDraft(input: FeedbackDraftInput) {
  const draftPrompt = `你是高中班主任助手。请严格依据以下反馈背景，为${input.studentName}生成${input.lengthRequirement}的家长反馈。语气温和、客观、鼓励为主，适合直接发送。

${input.promptContext}

只反馈该生本人表现，不比较、不提其他学生姓名；不得补充背景中不存在的成绩、考勤、事件或家校结论。直接返回反馈文本，不要标题或说明。`;
  return generateDraft(input.client, input.model, draftPrompt);
}

export async function reviewFeedbackDraft(input: FeedbackReviewInput): Promise<ReviewedFeedback> {
  const draftFeedback = input.draftFeedback;
  const forbiddenNames = [...new Set((input.forbiddenStudentNames ?? [])
    .map((name) => name.trim())
    .filter((name) => name && name !== input.studentName))];
  const reviewPrompt = `你是 Chem-Track 的反馈审核模型。请逐项对照“确定性反馈背景”审核起草稿，不得使用背景以外的知识，也不得新增事实。

确定性反馈背景：
${input.promptContext}

起草稿：
${draftFeedback}

审核规则：
1. 检查学生身份、成绩与趋势、考勤、事件、家校沟通是否有依据且没有冲突。
2. 检查是否比较或提到其他学生，是否把建议写成已发生事实。
3. 检查是否满足${input.lengthRequirement}、语气温和且适合直接发送。
4. 能在不新增事实的前提下修好时 verdict="revise" 并给出修订后的 feedback。
5. 完全可靠时 verdict="pass"；无法可靠修正时 verdict="needs_review"。
6. 只返回合法 JSON：{"verdict":"pass|revise|needs_review","feedback":"最终文本","issues":["简短原因"]}。`;
  const reviewed = await reviewDraft(input.client, input.model, reviewPrompt);
  if (!reviewed) {
    return {
      draftFeedback,
      feedback: draftFeedback,
      reviewStatus: "needs_review",
      reviewIssues: ["审核模型连续两次未返回合法结果，请人工检查"],
    };
  }

  let reviewStatus = normalizeVerdict(reviewed.verdict);
  const reviewIssues = normalizeIssues(reviewed.issues);
  const revisedFeedback = typeof reviewed.feedback === "string" ? reviewed.feedback.trim() : "";
  let feedback = reviewStatus === "revised" && revisedFeedback ? revisedFeedback : draftFeedback;
  if (reviewStatus === "revised" && !revisedFeedback) {
    reviewStatus = "needs_review";
    reviewIssues.push("审核模型要求修订但没有返回修订文本");
  }
  if (reviewStatus === "needs_review" && reviewIssues.length === 0) {
    reviewIssues.push("审核模型认为该反馈需要人工确认");
  }
  const mentionedOtherStudent = forbiddenNames.find((name) => feedback.includes(name));
  if (mentionedOtherStudent) {
    reviewStatus = "needs_review";
    reviewIssues.push("反馈中出现了其他学生姓名");
    feedback = draftFeedback;
  }

  return {
    draftFeedback,
    feedback,
    reviewStatus,
    reviewIssues: [...new Set(reviewIssues)],
  };
}
