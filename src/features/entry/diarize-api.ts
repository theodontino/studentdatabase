import { requestJson } from "@/lib/api-client";
import type { DiarizeEngine, DiarizeTask } from "./diarize-types";

export async function loadDiarizeTasks() {
  const data = await requestJson<{ tasks?: DiarizeTask[] }>("/api/diarize/tasks");
  return data.tasks ?? [];
}

export function loadDiarizeTask(taskId: string) {
  return requestJson<DiarizeTask>(`/api/diarize/tasks/${taskId}`);
}

export async function createDiarizeTask(audioFile: File, engine: DiarizeEngine) {
  const formData = new FormData();
  formData.append("audio", audioFile);
  formData.append("engine", engine);
  const response = await fetch("/api/diarize/tasks", { method: "POST", body: formData });
  if (!response.ok) {
    const data = await response.json() as { error?: string };
    throw new Error(data.error || "创建转写任务失败");
  }
  if (!response.body) throw new Error("转写任务流不可用");
  return response;
}

export async function retryDiarizeTask(taskId: string) {
  const response = await fetch(`/api/diarize/tasks/${taskId}/retry`, { method: "POST" });
  if (!response.ok) {
    const data = await response.json() as { error?: string };
    throw new Error(data.error || "重试失败");
  }
  if (!response.body) throw new Error("转写任务流不可用");
  return response;
}

export function deleteDiarizeTask(taskId: string) {
  return requestJson<void>(`/api/diarize/tasks/${taskId}`, { method: "DELETE" });
}
