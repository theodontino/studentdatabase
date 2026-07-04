import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWeComBridgeJson } from "@/services/wecom-bridge-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { sourceText?: string; exportPath?: string };
    return NextResponse.json(await generateWeComBridgeJson(prisma, body));
  } catch (error: any) {
    console.error("[/api/wecom/bridge] error:", error);
    return NextResponse.json({ error: error.message || "生成企微候选 JSON 失败" }, { status: 400 });
  }
}
