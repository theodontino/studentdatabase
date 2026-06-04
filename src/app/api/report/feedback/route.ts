import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLLMClient, getLLMModel } from "@/lib/llm";

// POST /api/report/feedback — 生成学生家校反馈文本
export async function POST(request: NextRequest) {
  try {
    const { studentId, days = 14 } = await request.json();
    if (!studentId) {
      return NextResponse.json({ error: "缺少学生ID" }, { status: 400 });
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split("T")[0];

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return NextResponse.json({ error: "学生不存在" }, { status: 404 });

    const [metrics, events, comms, attendances] = await Promise.all([
      prisma.dailyMetric.findMany({
        where: { studentId, date: { gte: sinceStr } },
        orderBy: { date: "desc" },
      }),
      prisma.event.findMany({
        where: { studentId, date: { gte: sinceStr } },
        orderBy: { date: "desc" },
      }),
      prisma.communication.findMany({
        where: { studentId, date: { gte: sinceStr } },
        orderBy: { date: "desc" },
      }),
      prisma.attendance.findMany({
        where: { studentId, session: { date: { gte: sinceStr } } },
        include: { session: { select: { date: true } } },
      }),
    ]);

    const avgA = metrics.length ? (metrics.reduce((s, m) => s + m.scoreA, 0) / metrics.length).toFixed(1) : "—";
    const avgB = metrics.length ? (metrics.reduce((s, m) => s + m.scoreB, 0) / metrics.length).toFixed(1) : "—";
    const avgC = metrics.length ? (metrics.reduce((s, m) => s + m.scoreC, 0) / metrics.length).toFixed(1) : "—";
    const totalSessions = attendances.length;
    const presentCount = attendances.filter((a) => a.present).length;
    const attRate = totalSessions ? `${presentCount}/${totalSessions}` : "无记录";
    const eventSummary = events.map((e) => e.description).join("；") || "无";
    const commSummary = comms.map((c) => `${c.date}与${c.target}沟通：${c.summary}`).join("；") || "无";

    const prompt = `你是高中班主任助手。请为${student.name}同学（${student.class}）生成一段100-150字的家长反馈文本。
要求：语气温和、客观、鼓励为主。适合直接发送给家长。

近${days}天数据：
- 学习(A): 均分${avgA} | 纪律(B): 均分${avgB} | 作业(C): 均分${avgC}
- 考勤: ${attRate}
- 关键事件: ${eventSummary}
- 家校沟通: ${commSummary}

请直接返回反馈文本，不要附带任何标题或说明。`;

    const client = createLLMClient();
    const model = getLLMModel();
    const resp = await client.chat.completions.create({
      model, messages: [{ role: "user", content: prompt }],
      temperature: 0.5, max_tokens: 512,
    });
    const feedback = resp.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({
      feedback,
      student: { name: student.name, class: student.class },
      period: `${sinceStr} ~ ${new Date().toISOString().split("T")[0]}`,
    });
  } catch (error) {
    console.error("POST /api/report/feedback error:", error);
    return NextResponse.json({ error: "生成反馈失败" }, { status: 500 });
  }
}
