import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLocalToolsStatus } = vi.hoisted(() => ({
  getLocalToolsStatus: vi.fn(),
}));

vi.mock("@/services/local-tool-status-service", () => ({ getLocalToolsStatus }));

import { GET } from "@/app/api/system/local-tools/route";

describe("GET /api/system/local-tools", () => {
  beforeEach(() => {
    getLocalToolsStatus.mockReset();
  });

  it("returns the read-only local tool status payload", async () => {
    getLocalToolsStatus.mockReturnValue({
      checkedAt: "2026-07-12T00:00:00.000Z",
      tools: [{
        id: "funasr",
        name: "FunASR",
        status: "warning",
        summary: "warning",
        checks: [],
      }],
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      checkedAt: "2026-07-12T00:00:00.000Z",
      tools: [expect.objectContaining({ id: "funasr", status: "warning" })],
    });
    expect(getLocalToolsStatus).toHaveBeenCalledOnce();
  });
});
