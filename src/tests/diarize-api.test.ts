import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "@/lib/api-client";
import {
  createDiarizeTask,
  deleteDiarizeTask,
  loadDiarizeTask,
  loadDiarizeTasks,
  retryDiarizeTask,
} from "@/features/entry/diarize-api";
import { formatDiarizeTime, isDiarizeSessionState } from "@/features/entry/diarize-types";

vi.mock("@/lib/api-client", () => ({ requestJson: vi.fn() }));

describe("diarize browser API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(requestJson).mockReset();
  });

  it("loads task lists and individual task operations through the shared client", async () => {
    vi.mocked(requestJson)
      .mockResolvedValueOnce({ tasks: [{ id: "task-1" }] } as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce({ id: "task-1" } as never)
      .mockResolvedValueOnce(undefined as never);
    expect(await loadDiarizeTasks()).toEqual([{ id: "task-1" }]);
    expect(await loadDiarizeTasks()).toEqual([]);
    await expect(loadDiarizeTask("task-1")).resolves.toEqual({ id: "task-1" });
    await expect(deleteDiarizeTask("task-1")).resolves.toBeUndefined();
    expect(requestJson).toHaveBeenNthCalledWith(3, "/api/diarize/tasks/task-1");
    expect(requestJson).toHaveBeenNthCalledWith(4, "/api/diarize/tasks/task-1", { method: "DELETE" });
  });

  it("creates a streamed task with audio and engine form data", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("event stream", { status: 200 }));
    const file = new File(["audio"], "lesson.wav", { type: "audio/wav" });
    await expect(createDiarizeTask(file, "local")).resolves.toBeInstanceOf(Response);
    const request = fetchMock.mock.calls[0];
    expect(request[0]).toBe("/api/diarize/tasks");
    const body = (request[1] as RequestInit).body as FormData;
    expect(body.get("audio")).toBe(file);
    expect(body.get("engine")).toBe("local");
  });

  it("reports create errors and a missing task stream", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ error: "音频无效" }), { status: 400 }));
    await expect(createDiarizeTask(new File(["x"], "x.wav"), "auto")).rejects.toThrow("音频无效");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(createDiarizeTask(new File(["x"], "x.wav"), "auto")).rejects.toThrow("转写任务流不可用");
  });

  it("retries streamed tasks and preserves server errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("retry stream", { status: 200 }));
    await expect(retryDiarizeTask("task-2")).resolves.toBeInstanceOf(Response);
    expect(fetchMock).toHaveBeenCalledWith("/api/diarize/tasks/task-2/retry", { method: "POST" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500 }));
    await expect(retryDiarizeTask("task-2")).rejects.toThrow("重试失败");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(retryDiarizeTask("task-2")).rejects.toThrow("转写任务流不可用");
  });
});

describe("diarize presentation types", () => {
  it("validates recoverable session state", () => {
    expect(isDiarizeSessionState({ engine: "auto", activeTaskId: "task-1" })).toBe(true);
    expect(isDiarizeSessionState({ engine: "local", activeTaskId: "" })).toBe(true);
    expect(isDiarizeSessionState({ engine: "cloud", activeTaskId: "task-1" })).toBe(false);
    expect(isDiarizeSessionState(null)).toBe(false);
  });

  it("formats timestamps and missing values", () => {
    expect(formatDiarizeTime(null)).toBe("—");
    expect(formatDiarizeTime("2026-07-16T00:00:00.000Z")).not.toBe("—");
  });
});
