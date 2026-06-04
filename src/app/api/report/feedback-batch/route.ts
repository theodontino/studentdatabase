import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLLMClient, getLLMModel } from "@/lib/llm";
import * as XLSX from "xlsx";

// In-memory cache: sessionCode → { buffer, timestamp, total, done }
const cache = new Map<string, { buffer: Uint8Array; timestamp: number; total: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

// GET /api/report/feedback-batch?sessionCode=xxx — 下载缓存的 Excel
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("sessionCode");
  if (!code) return NextResponse.json({ error: "缺少参数" }, { status: 400 });

  const cached = cache.get(code);
  if (!cached) return NextResponse.json({ error: "无缓存，请先生成" }, { status: 404 });
  if (Date.now() - cached.timestamp > CACHE_TTL) { cache.delete(code); return NextResponse.json({ error: "缓存已过期" }, { status: 410 }); }

  return new NextResponse(cached.buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="反馈_${code}.xlsx"`,
    },
  });
}

// POST /api/report/feedback-batch — 批量生成（后端缓存）
export async function POST(request: NextRequest) {
  try {
    const { sessionCode } = await request.json();
    if (!sessionCode) return NextResponse.json({ error: "缺少课次编码" }, { status: 400 });

    // Check cache
    const cached = cache.get(sessionCode);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ cached: true, total: cached.total, sessionCode });
    }

    const session = await prisma.classSession.findUnique({ where: { code: sessionCode } });
    if (!session) return NextResponse.json({ error: "课次不存在" }, { status: 404 });
    const className = session.class;
    if (!className) return NextResponse.json({ error: "该课次未关联班级" }, { status: 400 });

    const students = await prisma.student.findMany({
      where: { class: className }, select: { id: true, name: true },
    });
    if (students.length === 0) return NextResponse.json({ error: "该班级无学生" }, { status: 404 });

    const [metrics, attendances] = await Promise.all([
      prisma.dailyMetric.findMany({ where: { sessionId: session.id, studentId: { in: students.map(s => s.id) } } }),
      prisma.attendance.findMany({ where: { sessionId: session.id, studentId: { in: students.map(s => s.id) } } }),
    ]);
    const events = await prisma.event.findMany({ where: { date: session.date, studentId: { in: students.map(s => s.id) } } });

    const metricMap = new Map(metrics.map(m => [m.studentId, m]));
    const attMap = new Map(attendances.map(a => [a.studentId, a.present]));

    const client = createLLMClient();
    const model = getLLMModel();
    const results: { name: string; feedback: string }[] = [];

    // Generate per student, track progress
    let done = 0;
    const total = students.length;
    // Update cache progressively for polling
    cache.set(sessionCode, { buffer: new Uint8Array(), timestamp: Date.now(), total });

    for (const s of students) {
      const m = metricMap.get(s.id);
      const present = attMap.get(s.id);
      const evts = events.filter(e => e.studentId === s.id);
      const ctx = `${s.name}在${session.date}第${session.semesterNumber}次课：学习A:${m?.scoreA??"—"} 纪律B:${m?.scoreB??"—"} 作业C:${m?.scoreC??"—"} 考勤D:${m?.scoreD??"—"} 出勤:${present===undefined?"无":present?"到":"缺"} 事件:${evts.map(e=>e.description).join("；")||"无"}`;
      try {
        const resp = await client.chat.completions.create({
          model, messages: [{ role: "user", content: `${ctx}\n\n请为${s.name}生成50-80字反馈，温和客观，直接返回。` }],
          temperature: 0.5, max_tokens: 256,
        });
        results.push({ name: s.name, feedback: resp.choices[0]?.message?.content?.trim() || "" });
      } catch { results.push({ name: s.name, feedback: "[失败]" }); }
      done++;
      // Update progress
      cache.set(sessionCode, { buffer: new Uint8Array(), timestamp: Date.now(), total });
    }

    // Build Excel and cache
    const rows = results.map(r => ({ 姓名: r.name, 家校反馈: r.feedback }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "家校反馈");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    cache.set(sessionCode, { buffer: new Uint8Array(buf), timestamp: Date.now(), total });

    return NextResponse.json({ cached: true, total, sessionCode, className });
  } catch (error) {
    console.error("POST /api/report/feedback-batch error:", error);
    return NextResponse.json({ error: "批量生成失败" }, { status: 500 });
  }
}
