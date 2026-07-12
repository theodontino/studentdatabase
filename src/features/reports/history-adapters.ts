export interface DailyHistoryState { kind: "daily"; semesterId: string; className: string; sessionCode: string; report: string; }
export function isDailyHistoryState(value: unknown): value is DailyHistoryState { return Boolean(value && typeof value === "object" && (value as { kind?: unknown }).kind === "daily"); }
