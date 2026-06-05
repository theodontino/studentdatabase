import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLLMClient, getLLMModel } from "@/lib/llm";

// POST /api/report/feedback — 按课次或时间段生成家校反馈
export async function POST(request: NextRequest) {
  try {
    const { studentId, days, sessionCode } = await request.json();
    if (!studentId) return NextResponse.json({ error: "缺少学生ID" }, { status: 400 });

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: { select: { name: true } } },
    });
    if (!student) return NextResponse.json({ error: "学生不存在" }, { status: 404 });

    let metrics: any[], events: any[], comms: any[], attendances: any[];
    let context: string;

    if (sessionCode) {
      // Single-session mode
      const session = await prisma.classSession.findUnique({ where: { code: sessionCode } });
      if (!session) return NextResponse.json({ error: "课次不存在" }, { status: 404 });

      [metrics, attendances] = await Promise.all([
        prisma.sessionMetric.findMany({ where: { studentId, sessionId: session.id } }),
        prisma.attendance.findMany({ where: { sessionId: session.id, studentId } }),
      ]);
      events = await prisma.event.findMany({ where: { studentId, sessionId: session.id } });
      comms = await prisma.communication.findMany({ where: { studentId, sessionId: session.id } });

      const m = metrics[0];
      const att = attendances[0];
      context = `${student.name}（${student.class?.name ?? ""}）在 ${session.date} 第${session.semesterNumber}次课（${sessionCode}）的表现：
- 学习(A): ${m?.scoreA ?? "—"} | 纪律(B): ${m?.scoreB ?? "—"} | 作业(C): ${m?.scoreC ?? "—"} | 考勤(D): ${m?.scoreD ?? "—"}
- 出勤: ${att ? (att.present ? "到课" : "缺勤") : "无记录"}
- 事件: ${events.map((e) => e.description).join("；") || "无"}
- 沟通: ${comms.map((c) => `与${c.target}:${c.summary}`).join("；") || "无"}`;
    } else {
      // Time-range mode
      const d = days || 14;
      const since = new Date(); since.setDate(since.getDate() - d);
      const sinceStr = since.toISOString().split("T")[0];

      [metrics, events, comms, attendances] = await Promise.all([
        prisma.sessionMetric.findMany({ where: { studentId, date: { gte: sinceStr } }, orderBy: { date: "desc" } }),
        prisma.event.findMany({ where: { studentId, session: { date: { gte: sinceStr } } }, orderBy: { createdAt: "desc" }, include: { session: { select: { date: true } } } }),
        prisma.communication.findMany({ where: { studentId, session: { date: { gte: sinceStr } } }, orderBy: { createdAt: "desc" }, include: { session: { select: { date: true } } } }),
        prisma.attendance.findMany({ where: { studentId, session: { date: { gte: sinceStr } } }, include: { session: { select: { date: true } } } }),
      ]);

      const avgA = metrics.length ? (metrics.reduce((s, m) => s + m.scoreA, 0) / metrics.length).toFixed(1) : "—";
      const avgB = metrics.length ? (metrics.reduce((s, m) => s + m.scoreB, 0) / metrics.length).toFixed(1) : "—";
      const avgC = metrics.length ? (metrics.reduce((s, m) => s + m.scoreC, 0) / metrics.length).toFixed(1) : "—";
      const total = attendances.length;
      const present = attendances.filter((a) => a.present).length;
      context = `${student.name}（${student.class?.name ?? ""}）近${d}天表现：
- 学习(A): 均分${avgA} | 纪律(B): 均分${avgB} | 作业(C): 均分${avgC}
- 考勤: ${total ? `${present}/${total}` : "无记录"}
- 关键事件: ${events.map((e) => e.description).join("；") || "无"}
- 家校沟通: ${comms.map((c) => `${c.session?.date ?? "—"}与${c.target}:${c.summary}`).join("；") || "无"}`;
    }

    const prompt = `你是高中班主任助手。请为以下学生生成一段100-150字的家长反馈文本。语气温和、客观、鼓励为主，适合直接发送。

${context}

请直接返回反馈文本，不要附带标题或说明。`;

    const client = createLLMClient();
    const model = getLLMModel();
    const resp = await client.chat.completions.create({
      model, messages: [{ role: "user", content: prompt }],
      temperature: 0.5, max_tokens: 512,
    });

    return NextResponse.json({ feedback: resp.choices[0]?.message?.content?.trim() || "" });
  } catch (error) {
    console.error("POST /api/report/feedback error:", error);
    return NextResponse.json({ error: "生成反馈失败" }, { status: 500 });
  }
}
