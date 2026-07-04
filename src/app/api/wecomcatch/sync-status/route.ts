import { NextResponse } from "next/server";
import { runWeComCatchCommand } from "@/services/wecomcatch-service";

export async function GET() {
  try {
    return NextResponse.json(await runWeComCatchCommand("sync-status"));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "读取 WeComCatch 同步状态失败", result: error.result }, { status: 500 });
  }
}
