import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateSessionAttendance, type AttendanceUpdate } from "@/services/attendance-service";
import { ServiceError } from "@/services/service-error";

// GET /api/attendance?sessionId=xxx - get attendance for a session
// GET /api/attendance?studentId=xxx - get attendance history for a student
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const studentId = searchParams.get("studentId");

    if (!sessionId && !studentId) {
      return NextResponse.json({ error: "缺少 sessionId 或 studentId" }, { status: 400 });
    }

    if (studentId) {
      const records = await prisma.attendance.findMany({
        where: { studentId, ...(sessionId ? { sessionId } : {}) },
        include: { session: { select: { date: true, semesterNumber: true, code: true } } },
        orderBy: { createdAt: "desc" },
      });

      records.sort((a, b) => (
        b.session.date.localeCompare(a.session.date)
        || b.createdAt.getTime() - a.createdAt.getTime()
      ));

      return NextResponse.json(records);
    }

    if (!sessionId) {
      return NextResponse.json({ error: "缺少 sessionId" }, { status: 400 });
    }

    const records = await prisma.attendance.findMany({
      where: { sessionId },
      include: { student: { select: { name: true, class: { select: { name: true } } } } },
      orderBy: { student: { name: "asc" } },
    });

    return NextResponse.json(records);
  } catch (error) {
    console.error("[/api/attendance] error:", error);
    return NextResponse.json({ error: "获取考勤失败" }, { status: 500 });
  }
}

// PUT /api/attendance - batch update attendance
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as { sessionId: string; updates: AttendanceUpdate[] };
    return NextResponse.json(await updateSessionAttendance(body.sessionId, body.updates));
  } catch (error) {
    console.error("[/api/attendance] error:", error);
    if (error instanceof ServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "更新考勤失败" }, { status: 500 });
  }
}
