import { afterEach, describe, expect, it, vi } from "vitest";
import { saveWorkHistory } from "@/lib/history";

describe("saveWorkHistory", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("sends a recoverable snapshot and returns the saved record", async () => {
    const saved = { id: "history-1", module: "feedback", key: "S01", title: "反馈", state: { step: 2 }, createdAt: "2026-07-16T00:00:00.000Z" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(saved), { status: 200 }));
    await expect(saveWorkHistory("feedback", "反馈", { step: 2 }, "S01")).resolves.toEqual(saved);
    expect(fetchMock).toHaveBeenCalledWith("/api/history", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ module: "feedback", title: "反馈", state: { step: 2 }, key: "S01" }),
    }));
  });

  it("uses server and fallback errors without hiding failures", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ error: "历史被拒绝" }), { status: 400 }));
    await expect(saveWorkHistory("input", "草案", {})).rejects.toThrow("历史被拒绝");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500 }));
    await expect(saveWorkHistory("input", "草案", {})).rejects.toThrow("保存历史失败");
  });
});
