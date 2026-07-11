import * as XLSX from "xlsx";
import type { PrismaClient } from "@/generated/prisma/client";
import type { StudentAlert } from "@/services/alert-service";

export interface FeedbackExportCard {
  id: string;
  name: string;
  feedback: string;
  contextPreview?: { communications?: string[] };
}

function average(values: number[]) {
  if (values.length === 0) return "";
  return +(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
}

function alertText(alerts: StudentAlert[]) {
  return alerts.map((alert) => {
    const severity = alert.severity === "red" ? "严重" : "关注";
    if (alert.dimension === "考勤") return `${severity}：累计缺勤 ${alert.score} 次`;
    return `${severity}：${alert.dimension} ${alert.score} 分（班均 ${alert.classAvg}，相差 ${alert.deviation}）`;
  }).join("；");
}

/** Builds the standard post-class feedback workbook from persisted session data. */
export async function buildFeedbackExportWorkbook(
  prisma: PrismaClient,
  sessionCode: string,
  cards: FeedbackExportCard[],
  alerts: StudentAlert[],
) {
  const session = await prisma.classSession.findUnique({
    where: { code: sessionCode },
    select: { id: true, classId: true, date: true, semesterNumber: true },
  });
  if (!session) throw new Error("课次不存在");
  if (!session.classId) throw new Error("该课次未关联班级");

  const studentIds = cards.map((card) => card.id);
  const previousSessions = await prisma.classSession.findMany({
    where: {
      classId: session.classId,
      OR: [
        { date: { lt: session.date } },
        { date: session.date, semesterNumber: { lt: session.semesterNumber } },
      ],
    },
    select: { id: true },
    orderBy: [{ date: "desc" }, { semesterNumber: "desc" }, { createdAt: "desc" }],
  });

  const [currentMetrics, previousMetrics] = await Promise.all([
    prisma.sessionMetric.findMany({
      where: { sessionId: session.id, studentId: { in: studentIds } },
    }),
    prisma.sessionMetric.findMany({
      where: { sessionId: { in: previousSessions.map((item) => item.id) }, studentId: { in: studentIds } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const currentByStudent = new Map(currentMetrics.map((metric) => [metric.studentId, metric]));
  const previousByStudent = new Map<string, typeof previousMetrics[number]>();
  for (const metric of previousMetrics) {
    if (!previousByStudent.has(metric.studentId)) previousByStudent.set(metric.studentId, metric);
  }
  const alertsByStudent = new Map<string, StudentAlert[]>();
  for (const alert of alerts) {
    alertsByStudent.set(alert.studentId, [...(alertsByStudent.get(alert.studentId) ?? []), alert]);
  }

  const rows = cards.map((card) => {
    const current = currentByStudent.get(card.id);
    const previous = previousByStudent.get(card.id);
    return {
      姓名: card.name,
      本次学习测验: current?.scoreA ?? "",
      本次精神纪律: current?.scoreB ?? "",
      本次课后任务: current?.scoreC ?? "",
      上次学习测验: previous?.scoreA ?? "",
      上次精神纪律: previous?.scoreB ?? "",
      上次课后任务: previous?.scoreC ?? "",
      参考家校背景: card.contextPreview?.communications?.join("；") ?? "",
      预警: alertText(alertsByStudent.get(card.id) ?? []),
      最终反馈: card.feedback,
    };
  });

  rows.push({
    姓名: "班级均分",
    本次学习测验: average(currentMetrics.map((metric) => metric.scoreA)),
    本次精神纪律: average(currentMetrics.map((metric) => metric.scoreB)),
    本次课后任务: average(currentMetrics.map((metric) => metric.scoreC)),
    上次学习测验: average([...previousByStudent.values()].map((metric) => metric.scoreA)),
    上次精神纪律: average([...previousByStudent.values()].map((metric) => metric.scoreB)),
    上次课后任务: average([...previousByStudent.values()].map((metric) => metric.scoreC)),
    参考家校背景: "",
    预警: "",
    最终反馈: "",
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 48 },
    { wch: 40 }, { wch: 64 },
  ];
  worksheet["!autofilter"] = { ref: `A1:J${rows.length + 1}` };
  worksheet["!freeze"] = { xSplit: 1, ySplit: 1 };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "课后反馈");
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
}
