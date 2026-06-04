import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/quick-score?class=&date= — get existing scores for a class on a date
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const className = searchParams.get("class");
    const date = searchParams.get("date");

    if (!className || !date) {
      return NextResponse.json({ error: "缺少 class 或 date 参数" }, { status: 400 });
    }

    const students = await prisma.student.findMany({
      where: { class: className },
      select: { id: true, name: true },
    });

    const studentIds = students.map((s) => s.id);

    const metrics = await prisma.dailyMetric.findMany({
      where: { studentId: { in: studentIds }, date },
    });

    // Get attendance for sessions on this date (any class)
    const sessions = await prisma.classSession.findMany({
      where: { date },
      select: { id: true, code: true, semesterNumber: true, class: true },
    });

    const sessionIds = sessions.map((s) => s.id);
    const attendances = sessionIds.length > 0
      ? await prisma.attendance.findMany({
          where: { sessionId: { in: sessionIds }, studentId: { in: studentIds } },
        })
      : [];

    const metricMap = new Map(metrics.map((m) => [m.studentId, m]));
    const attMap = new Map(attendances.map((a) => [a.studentId, a]));

    const result = students.map((s) => {
      const m = metricMap.get(s.id);
      const a = attMap.get(s.id);
      return {
        studentId: s.id,
        studentName: s.name,
        scoreA: m?.scoreA ?? 3,
        scoreB: m?.scoreB ?? 3,
        scoreC: m?.scoreC ?? 3,
        present: a?.present ?? true,
      };
    });

    return NextResponse.json({
      date,
      className,
      sessions,
      scores: result,
    });
  } catch (error) {
    console.error("GET /api/quick-score error:", error);
    return NextResponse.json({ error: "获取评分数据失败" }, { status: 500 });
  }
}

interface ScoreEntry {
  studentId: string;
  date: string;
  scoreA: number;
  scoreB: number;
  scoreC: number;
  note?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scores, sessionCode, attendances } = body as {
      scores: ScoreEntry[];
      sessionCode?: string;
      attendances?: { studentId: string; present: boolean }[];
    };

    if (!scores || !Array.isArray(scores) || scores.length === 0) {
      return NextResponse.json({ error: "请提交至少一条评分" }, { status: 400 });
    }

    let count = 0;
    const date = scores[0]?.date;

    for (const entry of scores) {
      if (!entry.studentId || !entry.date) continue;
      const a = Math.max(0, Math.min(5, entry.scoreA ?? 3));
      const b = Math.max(0, Math.min(5, entry.scoreB ?? 3));
      const c = Math.max(0, Math.min(5, entry.scoreC ?? 3));

      await prisma.dailyMetric.upsert({
        where: { studentId_date: { studentId: entry.studentId, date: entry.date } },
        create: { studentId: entry.studentId, date: entry.date, scoreA: a, scoreB: b, scoreC: c },
        update: { scoreA: a, scoreB: b, scoreC: c },
      });

      if (entry.note && entry.note.trim()) {
        await prisma.event.create({
          data: { studentId: entry.studentId, date: entry.date,
            type: "课堂表现", description: entry.note.trim(), rawText: entry.note.trim() },
        });
      }
      count++;
    }

    // If sessionCode, sync attendance and recalculate D
    let attUpdated = 0;
    if (sessionCode && date) {
      const session = await prisma.classSession.findUnique({ where: { code: sessionCode } });
      if (session && attendances && Array.isArray(attendances)) {
        for (const a of attendances) {
          await prisma.attendance.updateMany({
            where: { sessionId: session.id, studentId: a.studentId },
            data: { present: a.present },
          });
          attUpdated++;
        }
        // Recalculate D
        const totalSessions = await prisma.classSession.count({ where: { semesterId: session.semesterId } });
        if (totalSessions > 0) {
          const students = await prisma.student.findMany({ select: { id: true } });
          for (const s of students) {
            const presentCount = await prisma.attendance.count({
              where: { studentId: s.id, present: true, session: { semesterId: session.semesterId } },
            });
            const scoreD = Math.round((5 * presentCount) / totalSessions);
            await prisma.dailyMetric.upsert({
              where: { studentId_date: { studentId: s.id, date } },
              create: { studentId: s.id, date, scoreA: 0, scoreB: 0, scoreC: 0, scoreD },
              update: { scoreD },
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, count, attUpdated });
  } catch (error) {
    console.error("POST /api/quick-score error:", error);
    return NextResponse.json({ error: "提交失败" }, { status: 500 });
  }
}
