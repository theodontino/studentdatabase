import { NextResponse } from "next/server";
import { runWeComCatchCommand } from "@/services/wecomcatch-service";

export async function POST() {
  try {
    return NextResponse.json(await runWeComCatchCommand("export"));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "导出 WeComCatch 记录失败", result: error.result }, { status: 500 });
  }
}
