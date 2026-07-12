import { beforeEach, describe, expect, it, vi } from "vitest";

const { runWeComCatchCommand, preflightWeComCatchSync } = vi.hoisted(() => ({
  runWeComCatchCommand: vi.fn(),
  preflightWeComCatchSync: vi.fn(),
}));

vi.mock("@/services/wecomcatch-service", () => ({ runWeComCatchCommand }));
vi.mock("@/services/local-tool-status-service", () => ({ preflightWeComCatchSync }));

import { POST } from "@/app/api/wecomcatch/sync-start/route";

describe("POST /api/wecomcatch/sync-start", () => {
  beforeEach(() => {
    runWeComCatchCommand.mockReset();
    preflightWeComCatchSync.mockReset();
  });

  it("does not start sync when a required local path is missing", async () => {
    preflightWeComCatchSync.mockReturnValue({
      ready: false,
      blockers: ["WeComCatch CLI 不存在或不可执行"],
    });

    const response = await POST();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("WeComCatch CLI"),
      preflight: { ready: false },
    });
    expect(runWeComCatchCommand).not.toHaveBeenCalled();
  });

  it("keeps the existing successful response after preflight passes", async () => {
    preflightWeComCatchSync.mockReturnValue({ ready: true, blockers: [] });
    runWeComCatchCommand.mockResolvedValue({ command: "sync-start", stdout: "", stderr: "" });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      command: "sync-start",
      warning: expect.stringContaining("同步可能切换企微会话"),
    });
  });
});
