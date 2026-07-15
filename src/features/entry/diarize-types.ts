export type DiarizeEngine = "auto" | "local" | "tingwu";
export type DiarizeTaskStatus = "queued" | "running" | "succeeded" | "failed";
export type RecordingState = "idle" | "recording" | "recorded";

export interface DiarizeTask {
  id: string;
  title: string;
  engine: DiarizeEngine;
  speakerCount: number | null;
  status: DiarizeTaskStatus;
  inputFileName: string;
  retryOf: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  hasResultText: boolean;
  hasResultJson: boolean;
  resultText?: string;
  log?: string;
}

export interface DiarizeSessionState { engine: DiarizeEngine; activeTaskId: string; }

export function isDiarizeSessionState(value: unknown): value is DiarizeSessionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<DiarizeSessionState>;
  return (state.engine === "auto" || state.engine === "local" || state.engine === "tingwu")
    && typeof state.activeTaskId === "string";
}

export const DIARIZE_ENGINES: Array<{ value: DiarizeEngine; label: string; note: string }> = [
  { value: "auto", label: "自动", note: "先云端，失败后降级" },
  { value: "local", label: "本地", note: "不上传云端" },
  { value: "tingwu", label: "听悟", note: "使用阿里云" },
];

export const DIARIZE_STATUS_LABEL: Record<DiarizeTaskStatus, string> = {
  queued: "等待中",
  running: "处理中",
  succeeded: "完成",
  failed: "失败",
};

export const DIARIZE_STATUS_CLASS: Record<DiarizeTaskStatus, string> = {
  queued: "bg-gray-100 text-gray-600",
  running: "bg-blue-50 text-blue-700",
  succeeded: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
};

export function formatDiarizeTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}
