import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";
import { createLLMClient, getLLMModel } from "@/lib/llm";

export interface GenerateWeComBridgeInput {
  sourceText?: string;
  exportPath?: string;
}

export interface GenerateWeComBridgeResult {
  sourceLabel: string;
  bridgeJson: unknown;
  rawOutput: string;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJsonObject(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("LLM 未返回合法 JSON");
  }
}

async function loadSource(input: GenerateWeComBridgeInput) {
  const sourceText = clean(input.sourceText);
  if (sourceText) return { text: sourceText, sourceLabel: "粘贴的企微文本" };

  const exportPath = clean(input.exportPath);
  if (!exportPath) throw new Error("缺少企微导出文本或文件路径");
  const resolvedPath = resolve(exportPath);
  return { text: await readFile(resolvedPath, "utf8"), sourceLabel: resolvedPath };
}

export async function generateWeComBridgeJson(
  prisma: PrismaClient,
  input: GenerateWeComBridgeInput
): Promise<GenerateWeComBridgeResult> {
  const { text, sourceLabel } = await loadSource(input);
  const students = await prisma.student.findMany({
    select: {
      id: true,
      name: true,
      studentId: true,
      class: { select: { name: true, code: true } },
    },
    orderBy: { studentId: "asc" },
  });
  const roster = students.map((student) => ({
    id: student.id,
    name: student.name,
    studentId: student.studentId,
    className: student.class?.name ?? student.class?.code ?? "",
  }));

  const clippedText = text.length > 24_000 ? text.slice(-24_000) : text;
  const prompt = `你是 Chem-Track 的企微家校沟通提取器。请从企微聊天导出中提取对“课后反馈”有长期价值、且能明确绑定到某个学生的家校沟通信息。

学生名单：
${JSON.stringify(roster, null, 2)}

输出要求：
1. 只返回合法 JSON，不要 Markdown，不要解释。
2. JSON 顶层格式必须是：
{
  "source": "wecomcatch",
  "mode": "candidateOnly",
  "records": []
}
3. 只生成 kind="communication" 的 records。
4. 如果不能明确匹配唯一学生，matchedStudent.confidence 填 "low"，不要臆测。
5. 没有明确课次时 sessionCode 填 null。
6. summaryForChemTrack 要写成适合 Chem-Track 入库的摘要，保留“家长关注点、学生状态、后续反馈口径或行动建议”。
7. feedbackContext.toneHint 和 nextAction 用于之后生成家长反馈，必须简短可执行。

record 示例：
{
  "kind": "communication",
  "source": { "conversationId": null, "conversationTitle": "张三妈妈" },
  "matchedStudent": { "id": "学生id", "name": "张三", "studentId": "S001", "confidence": "high" },
  "occurredAt": "2026-07-04",
  "sessionCode": null,
  "target": "母亲",
  "summary": "原始沟通要点摘要",
  "summaryForChemTrack": "面向 Chem-Track 的家校沟通摘要",
  "feedbackContext": { "toneHint": "语气提示", "nextAction": "下一步建议" },
  "confidence": "high"
}

企微导出内容：
${clippedText}`;

  const client = createLLMClient();
  const model = getLLMModel();
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 8192,
  });
  const rawOutput = response.choices[0]?.message?.content?.trim() || "";
  if (!rawOutput) throw new Error("LLM 未返回企微候选 JSON");

  const bridgeJson = parseJsonObject(rawOutput);
  if (!Array.isArray((bridgeJson as { records?: unknown }).records)) {
    throw new Error("LLM 返回 JSON 缺少 records 数组");
  }

  return { sourceLabel, bridgeJson, rawOutput };
}
