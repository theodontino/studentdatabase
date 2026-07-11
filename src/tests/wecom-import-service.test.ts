import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { planWeComCommunicationImport } from "@/services/wecom-import-service";

describe("wecom import service", () => {
  it("plans unknown-session communication with first class session fallback", async () => {
    const student = await prisma.student.findFirst({
      select: { id: true, name: true, studentId: true },
      orderBy: { studentId: "asc" },
    });
    expect(student).toBeTruthy();

    const result = await planWeComCommunicationImport(prisma, {
      jsonText: JSON.stringify({
        source: "wecomcatch",
        mode: "candidateOnly",
        records: [
          {
            kind: "communication",
            source: { conversationId: "ax-vitest", conversationTitle: `${student!.name}妈妈` },
            matchedStudent: {
              id: student!.id,
              name: student!.name,
              studentId: student!.studentId,
              confidence: "high",
            },
            occurredAt: "2026-07-02",
            sessionCode: null,
            target: "母亲",
            summary: "家长反馈孩子近期状态稳定，老师建议继续保持复盘。",
            confidence: "high",
          },
        ],
      }),
    });

    expect(result.communicationCandidateCount).toBe(1);
    expect(result.importableCount).toBe(1);
    expect(result.plans[0]).toMatchObject({
      binding: "first_class_session_fallback",
      target: "母亲",
      student: { name: student!.name, studentId: student!.studentId },
    });
    expect(result.plans[0].summary).toContain("企微长期沟通");
  });
});
