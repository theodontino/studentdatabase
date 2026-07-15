export const ATTENTION_REASONS = [
  "academic-performance",
  "learning-confidence",
  "parent-concern",
  "withdrawal-intent",
] as const;

export type AttentionReason = typeof ATTENTION_REASONS[number];
export type AttentionConfidence = "high" | "medium" | "low";

export interface AttentionSignalCandidate {
  reason: AttentionReason;
  confidence: AttentionConfidence;
  evidenceSummary: string;
}

export const INTERNAL_ATTENTION_LABELS: Record<AttentionReason, string> = {
  "academic-performance": "AI内部关注：成绩表现",
  "learning-confidence": "AI内部关注：学习信心",
  "parent-concern": "AI内部关注：家长担心",
  "withdrawal-intent": "AI内部关注：退班意向",
};

export const ATTENTION_REASON_NAMES: Record<AttentionReason, string> = {
  "academic-performance": "成绩表现",
  "learning-confidence": "学习信心",
  "parent-concern": "家长担心",
  "withdrawal-intent": "退班意向",
};

const reasonByLabel = new Map(Object.entries(INTERNAL_ATTENTION_LABELS).map(([reason, label]) => [label, reason as AttentionReason]));

export function isInternalAttentionLabel(label: string) {
  return label.startsWith("AI内部关注：");
}

export function publicStudentLabels(labels: string[]) {
  return labels.filter((label) => !isInternalAttentionLabel(label));
}

export function attentionReasonsFromLabels(labels: string[]) {
  return [...new Set(labels.map((label) => reasonByLabel.get(label)).filter((reason): reason is AttentionReason => Boolean(reason)))];
}

export function normalizeAttentionSignalCandidates(value: unknown): AttentionSignalCandidate[] {
  if (!Array.isArray(value)) return [];
  const byReason = new Map<AttentionReason, AttentionSignalCandidate>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<AttentionSignalCandidate>;
    if (!ATTENTION_REASONS.includes(candidate.reason as AttentionReason)) continue;
    if (!["high", "medium", "low"].includes(candidate.confidence ?? "")) continue;
    const evidenceSummary = typeof candidate.evidenceSummary === "string" ? candidate.evidenceSummary.trim().slice(0, 240) : "";
    if (!evidenceSummary) continue;
    const normalized = { reason: candidate.reason as AttentionReason, confidence: candidate.confidence as AttentionConfidence, evidenceSummary };
    const existing = byReason.get(normalized.reason);
    const priority = { high: 3, medium: 2, low: 1 } as const;
    if (!existing || priority[normalized.confidence] > priority[existing.confidence]) byReason.set(normalized.reason, normalized);
  }
  return [...byReason.values()];
}
