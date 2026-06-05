import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/logger";

describe("SystemLog (Integration)", () => {
  afterAll(async () => {
    await prisma.systemLog.deleteMany({ where: { targetId: "test-student-1" } });
    await prisma.systemLog.deleteMany({ where: { targetId: "test-batch" } });
    await prisma.$disconnect();
  });

  it("logAction writes to database", async () => {
    await logAction({
      action: "score.updated",
      targetType: "Student",
      targetId: "test-student-1",
      targetName: "测试学生",
      detail: { scoreA: 4, scoreB: 3, scoreC: 2 },
    });

    const log = await prisma.systemLog.findFirst({
      where: { targetId: "test-student-1" },
      orderBy: { createdAt: "desc" },
    });

    expect(log).not.toBeNull();
    expect(log!.action).toBe("score.updated");
    expect(log!.targetName).toBe("测试学生");
    expect(JSON.parse(log!.detail)).toEqual({ scoreA: 4, scoreB: 3, scoreC: 2 });
  });

  it("logAction does not throw (fire-and-forget)", async () => {
    await expect(
      logAction({ action: "score.updated", targetType: "Student" })
    ).resolves.toBeUndefined();
  });

  it("stores multiple action types correctly", async () => {
    const entries = [
      { action: "student.deleted" as const, targetType: "Student" as const, detail: { reason: "退学" } },
      { action: "session.created" as const, targetType: "Session" as const, detail: { date: "2026-06-05" } },
      { action: "alert.triggered" as const, targetType: "Student" as const, detail: { severity: "red" } },
    ];

    for (const entry of entries) {
      await logAction({ ...entry, targetId: "test-batch", targetName: "批量测试" });
    }

    const logs = await prisma.systemLog.findMany({
      where: { targetId: "test-batch" },
      orderBy: { createdAt: "desc" },
    });

    expect(logs).toHaveLength(3);
    expect(logs.map((l) => l.action).sort()).toEqual(
      ["alert.triggered", "session.created", "student.deleted"].sort()
    );
  });
});
