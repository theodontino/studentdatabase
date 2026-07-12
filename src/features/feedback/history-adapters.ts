export interface LegacyFeedbackState { kind: "batch" | "single"; semesterId: string; className: string; sessionCode: string; }
export function isLegacyFeedbackState(value: unknown): value is LegacyFeedbackState { const kind = value && typeof value === "object" ? (value as { kind?: unknown }).kind : null; return kind === "batch" || kind === "single"; }
