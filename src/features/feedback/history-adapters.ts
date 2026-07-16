import type { InputHistoryState } from "@/features/entry";

export interface LegacyFeedbackState { kind: "batch" | "single"; semesterId: string; className: string; sessionCode: string; }
export function isLegacyFeedbackState(value: unknown): value is LegacyFeedbackState { const kind = value && typeof value === "object" ? (value as { kind?: unknown }).kind : null; return kind === "batch" || kind === "single"; }

export function isInputHistoryState(value: unknown): value is InputHistoryState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<InputHistoryState>;
  return typeof state.rawText === "string"
    && typeof state.semesterId === "string"
    && typeof state.className === "string"
    && typeof state.sessionCode === "string"
    && Boolean(state.result)
    && typeof state.result?.draftId === "string"
    && typeof state.result?.rawText === "string"
    && typeof state.result?.parsedResult === "object";
}
