import { prisma } from "./prisma";

/**
 * v0.5: Archive current DailyMetric values to history before update.
 * Call this BEFORE updating a DailyMetric row.
 */
export async function archiveMetricBeforeUpdate(metricId: string, changeType: "update" | "delete" = "update") {
  const current = await prisma.dailyMetric.findUnique({ where: { id: metricId } });
  if (!current) return;

  await prisma.dailyMetricHistory.create({
    data: {
      metricId: current.id,
      studentId: current.studentId,
      date: current.date,
      scoreA: current.scoreA,
      scoreB: current.scoreB,
      scoreC: current.scoreC,
      scoreD: current.scoreD,
      operator: current.operator,
      sessionId: current.sessionId,
      changeType,
    },
  });
}
