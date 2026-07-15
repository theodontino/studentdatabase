import type { Prisma } from "@/generated/prisma/client";
import { INTERNAL_ATTENTION_LABELS, type AttentionSignalCandidate } from "@/lib/attention-labels";

export async function addHighConfidenceAttentionLabels(
  tx: Prisma.TransactionClient,
  studentId: string,
  candidates: AttentionSignalCandidate[],
) {
  const names = [...new Set(candidates.filter((candidate) => candidate.confidence === "high").map((candidate) => INTERNAL_ATTENTION_LABELS[candidate.reason]))];
  let createdCount = 0;
  for (const name of names) {
    const label = await tx.label.upsert({ where: { name }, create: { name }, update: {} });
    const existing = await tx.studentLabel.findUnique({ where: { studentId_labelId: { studentId, labelId: label.id } } });
    if (existing) continue;
    await tx.studentLabel.create({ data: { studentId, labelId: label.id } });
    createdCount += 1;
  }
  return createdCount;
}
