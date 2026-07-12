import { NextResponse } from "next/server";
import { runWeComCatchCommand } from "@/services/wecomcatch-service";
import { preflightWeComCatchSync } from "@/services/local-tool-status-service";

export async function POST() {
  const preflight = preflightWeComCatchSync();
  if (!preflight.ready) {
    return NextResponse.json({
      error: `WeComCatch 环境不可用：${preflight.blockers.join("；")}`,
      preflight,
    }, { status: 503 });
  }

  try {
    const result = await runWeComCatchCommand("sync-start");
    return NextResponse.json({
      ...result,
      warning: "同步可能切换企微会话并改变未读状态，请保持 Mac 解锁且不要调整企微窗口。",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "启动 WeComCatch 同步失败", result: error.result }, { status: 500 });
  }
}
