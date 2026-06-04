import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLLMClient, getLLMModel } from "@/lib/llm";

// POST /api/report/daily — 生成班级日报
export async function POST(request: NextRequest) {
  try {
    const { semesterId, className, date } = await request.json();
    if (!semesterId || !className || !date) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    const students = await prisma.student.findMany({
      where: { class: className },
      select: { id: true, name: true },
    });
    if (students.length === 0) {
      return NextResponse.json({ error: "该班级无学生" }, { status: 404 });
    }

    const studentIds = students.map((s) => s.id);

    const [metrics, events, attendances] = await Promise.all([
      prisma.dailyMetric.findMany({
        where: { studentId: { in: studentIds }, date },
      }),
      prisma.event.findMany({
        where: { studentId: { in: studentIds }, date },
      }),
      prisma.attendance.findMany({
        where: { studentId: { in: studentIds }, session: { date } },
        include: { session: { select: { code: true } } },
      }),
    ]);

    const metricMap = new Map(metrics.map((m) => [m.studentId, m]));
    const attMap = new Map(attendances.map((a) => [a.studentId, a.present]));

    // Build per-student summary
    const studentLines = students.map((s) => {
      const m = metricMap.get(s.id);
      const present = attMap.get(s.id);
      const studentEvents = events.filter((e) => e.studentId === s.id);
      const scores = m
        ? `A${m.scoreA}/B${m.scoreB}/C${m.scoreC}/D${m.scoreD}`
        : "无评分";
      const att = present === undefined ? "无考勤" : present ? "出勤" : "缺勤";
      const evt = studentEvents.map((e) => e.description).join("；") || "无";
      return `${s.name}: ${scores} | ${att} | ${evt}`;
    });

    const prompt = `你是高中班级的班主任助手。以下是${className}在${date}的学生数据，请生成一段200-300字自然语言班级日报。
要求：客观、简洁、有重点。突出表现优秀和需要关注的学生，无需逐一点名。

${studentLines.join("\n")}

请直接返回日报文本，不要附带标题或markdown。`;

    const client = createLLMClient();
    const model = getLLMModel();
    const resp = await client.chat.completions.create({
      model, messages: [{ role: "user", content: prompt }],
      temperature: 0.5, max_tokens: 1024,
    });
    const report = resp.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ report, studentCount: students.length });
  } catch (error) {
    console.error("POST /api/report/daily error:", error);
    return NextResponse.json({ error: "生成日报失败" }, { status: 500 });
  }
}
