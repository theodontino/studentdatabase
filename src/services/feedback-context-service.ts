import type { PrismaClient } from "@/generated/prisma/client";
import { publicStudentLabels } from "@/lib/attention-labels";

const RECENT_SESSION_LIMIT = 5;
const COMMUNICATION_LIMIT = 3;
const EVENT_LIMIT = 3;

export interface FeedbackContextPreview {
  today: string[];
  trend: string;
  communications: string[];
  labels: string[];
}

export interface FeedbackContextStudent {
  id: string;
  name: string;
  studentId: string;
  labels: string[];
  promptContext: string;
  preview: FeedbackContextPreview;
}

export interface FeedbackContextResult {
  session: {
    id: string;
    code: string;
    date: string;
    semesterId: string;
    semesterNumber: number;
    classId: string;
  };
  className: string;
  total: number;
  students: FeedbackContextStudent[];
}

function scoreText(value: number | null | undefined) {
  return value === null || value === undefined ? "无记录" : `${value}分`;
}

function attendanceText(value: boolean | undefined) {
  if (value === undefined) return "无记录";
  return value ? "到课" : "缺勤";
}

function shortSummary(value: string, limit = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function groupByStudent<T extends { studentId: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const list = grouped.get(item.studentId) ?? [];
    list.push(item);
    grouped.set(item.studentId, list);
  }
  return grouped;
}

function buildTodayPreview(input: {
  metric?: { scoreA: number; scoreB: number; scoreC: number; scoreD: number };
  attendance?: boolean;
  events: string[];
}) {
  const lines = [
    `学习&测验 ${scoreText(input.metric?.scoreA)}`,
    `精神&纪律 ${scoreText(input.metric?.scoreB)}`,
    `课后任务 ${scoreText(input.metric?.scoreC)}`,
    `考勤 ${scoreText(input.metric?.scoreD)} / ${attendanceText(input.attendance)}`,
  ];
  if (input.events.length > 0) lines.push(`关键事件：${input.events.join("；")}`);
  return lines;
}

function buildTrendPreview(metrics: Array<{
  scoreA: number;
  scoreB: number;
  scoreC: number;
  scoreD: number;
  session: { code: string; date: string; semesterNumber: number } | null;
}>) {
  if (metrics.length === 0) return "暂无近期评分趋势";

  const chronological = [...metrics].reverse();
  return chronological.map((metric) => {
    const label = metric.session
      ? `${metric.session.date} 第${metric.session.semesterNumber}次`
      : "未知课次";
    return `${label}: A${metric.scoreA}/B${metric.scoreB}/C${metric.scoreC}/D${metric.scoreD}`;
  }).join("；");
}

function buildPromptContext(input: {
  studentName: string;
  sessionDate: string;
  semesterNumber: number;
  labels: string[];
  today: string[];
  trend: string;
  communications: string[];
}) {
  const labels = input.labels.length > 0 ? input.labels.join("、") : "无";
  const communications = input.communications.length > 0 ? input.communications.join("；") : "无";
  return [
    `${input.studentName}，${input.sessionDate}第${input.semesterNumber}次课。`,
    `学生标签：${labels}`,
    `今日表现：${input.today.join("；")}`,
    `近期趋势：${input.trend}`,
    `近期家校沟通：${communications}`,
  ].join("\n");
}

/**
 * Builds deterministic feedback context from existing Student Track records.
 * LLM generation may consume the compact promptContext, while UI can render preview.
 */
export async function buildFeedbackContext(
  prisma: PrismaClient,
  sessionCode: string
): Promise<FeedbackContextResult> {
  const session = await prisma.classSession.findUnique({
    where: { code: sessionCode },
    include: { class: { select: { name: true, code: true } } },
  });
  if (!session) throw new Error("课次不存在");
  if (!session.classId) throw new Error("该课次未关联班级");

  const className = session.class?.name ?? session.class?.code ?? "";
  if (!className) throw new Error("该课次未关联班级");

  const students = await prisma.student.findMany({
    where: { classId: session.classId },
    select: {
      id: true,
      name: true,
      studentId: true,
      studentLabels: { include: { label: { select: { name: true } } } },
    },
    orderBy: { studentId: "asc" },
  });
  if (students.length === 0) throw new Error("该班级无学生");

  const studentIds = students.map((student) => student.id);
  const recentSessions = await prisma.classSession.findMany({
    where: {
      classId: session.classId,
      OR: [
        { date: { lt: session.date } },
        { date: session.date, semesterNumber: { lte: session.semesterNumber } },
      ],
    },
    select: { id: true, code: true, date: true, semesterNumber: true, createdAt: true },
    orderBy: [{ date: "desc" }, { semesterNumber: "desc" }, { createdAt: "desc" }],
    take: RECENT_SESSION_LIMIT,
  });
  const recentSessionIds = recentSessions.map((item) => item.id);

  const [currentMetrics, currentAttendances, currentEvents, recentMetrics, recentEvents, communications] =
    await Promise.all([
      prisma.sessionMetric.findMany({ where: { sessionId: session.id, studentId: { in: studentIds } } }),
      prisma.attendance.findMany({ where: { sessionId: session.id, studentId: { in: studentIds } } }),
      prisma.event.findMany({
        where: { sessionId: session.id, studentId: { in: studentIds } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.sessionMetric.findMany({
        where: { studentId: { in: studentIds }, sessionId: { in: recentSessionIds } },
        include: { session: { select: { code: true, date: true, semesterNumber: true } } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.event.findMany({
        where: { studentId: { in: studentIds }, sessionId: { in: recentSessionIds } },
        include: { session: { select: { code: true, date: true, semesterNumber: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.communication.findMany({
        where: { studentId: { in: studentIds } },
        include: { session: { select: { code: true, date: true, semesterNumber: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const currentMetricMap = new Map(currentMetrics.map((metric) => [metric.studentId, metric]));
  const attendanceMap = new Map(currentAttendances.map((attendance) => [attendance.studentId, attendance.present]));
  const currentEventsByStudent = groupByStudent(currentEvents);
  const recentMetricsByStudent = groupByStudent(recentMetrics);
  const recentEventsByStudent = groupByStudent(recentEvents);
  const communicationsByStudent = groupByStudent(communications);

  const contextStudents = students.map((student): FeedbackContextStudent => {
    const labels = publicStudentLabels(student.studentLabels.map((item) => item.label.name));
    const currentEventTexts = (currentEventsByStudent.get(student.id) ?? []).map((event) => event.description);
    const today = buildTodayPreview({
      metric: currentMetricMap.get(student.id),
      attendance: attendanceMap.get(student.id),
      events: currentEventTexts,
    });

    const trend = buildTrendPreview(recentMetricsByStudent.get(student.id) ?? []);
    const communicationLines = (communicationsByStudent.get(student.id) ?? [])
      .slice(0, COMMUNICATION_LIMIT)
      .map((communication) => {
        const date = communication.session?.date ?? "未知日期";
        return `${date} 与${communication.target}：${shortSummary(communication.summary)}`;
      });
    const recentEventLines = (recentEventsByStudent.get(student.id) ?? [])
      .filter((event) => event.sessionId !== session.id)
      .slice(0, EVENT_LIMIT)
      .map((event) => `${event.session?.date ?? "未知日期"} ${shortSummary(event.description, 80)}`);
    const preview: FeedbackContextPreview = {
      today,
      trend: recentEventLines.length > 0 ? `${trend}；近期事件：${recentEventLines.join("；")}` : trend,
      communications: communicationLines,
      labels,
    };

    return {
      id: student.id,
      name: student.name,
      studentId: student.studentId,
      labels,
      promptContext: buildPromptContext({
        studentName: student.name,
        sessionDate: session.date,
        semesterNumber: session.semesterNumber,
        labels,
        today,
        trend: preview.trend,
        communications: communicationLines,
      }),
      preview,
    };
  });

  return {
    session: {
      id: session.id,
      code: session.code,
      date: session.date,
      semesterId: session.semesterId,
      semesterNumber: session.semesterNumber,
      classId: session.classId,
    },
    className,
    total: contextStudents.length,
    students: contextStudents,
  };
}
