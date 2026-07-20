import { NextRequest, NextResponse } from "next/server";
import {
  clearLLMCache,
  getLLMCacheOverview,
  type LLMTaskType,
} from "@/services/llm-cache-service";

export const runtime = "nodejs";

const taskTypes = new Set<LLMTaskType>(["wecom", "classroom-parse", "feedback", "daily-report"]);

export async function GET() {
  try {
    return NextResponse.json(await getLLMCacheOverview());
  } catch {
    return NextResponse.json({ error: "读取 LLM 缓存清单失败" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const value = new URL(request.url).searchParams.get("taskType");
  if (value && !taskTypes.has(value as LLMTaskType)) {
    return NextResponse.json({ error: "无效的 LLM 缓存任务类型" }, { status: 400 });
  }
  try {
    return NextResponse.json(await clearLLMCache(value as LLMTaskType | undefined));
  } catch {
    return NextResponse.json({ error: "清理 LLM 缓存失败" }, { status: 500 });
  }
}
