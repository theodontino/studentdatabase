import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { buildFeedbackContext } from "@/services/feedback-context-service";

let classId = "";
let semesterId = "";
let studentIds: string[] = [];
let labelName = "";
let currentSessionCode = "";

beforeEach(async () => {
  const suffix = randomUUID().slice(0, 8);
  labelName = `#反馈上下文-${suffix}`;
  const classroom = await prisma.class.create({
    data: { code: `CTX-${suffix}`, name: `上下文测试班-${suffix}` },
  });
  classId = classroom.id;
  const semester = await prisma.semester.create({
    data: { name: `上下文测试学期-${suffix}`, startDate: "2099-01-01", endDate: "2099-12-31" },
  });
  semesterId = semester.id;
  const student = await prisma.student.create({
    data: { name: `上下文学生-${suffix}`, studentId: `CTX-STU-${suffix}`, gender: "女", classId },
  });
  const studentWithoutHistory = await prisma.student.create({
    data: { name: `无历史学生-${suffix}`, studentId: `CTX-NO-${suffix}`, gender: "男", classId },
  });
  studentIds = [student.id, studentWithoutHistory.id];
  const label = await prisma.label.create({ data: { name: labelName } });
  await prisma.studentLabel.create({ data: { studentId: student.id, labelId: label.id } });

  const previousSession = await prisma.classSession.create({
    data: { code: `CTX${suffix}01`, semesterId, semesterNumber: 1, date: "2099-03-01", classId },
  });
  const currentSession = await prisma.classSession.create({
    data: { code: `CTX${suffix}02`, semesterId, semesterNumber: 2, date: "2099-03-08", classId },
  });
  currentSessionCode = currentSession.code;

  await prisma.sessionMetric.createMany({
    data: [
      {
        studentId: student.id,
        sessionId: previousSession.id,
        date: previousSession.date,
        scoreA: 3,
        scoreB: 4,
        scoreC: 3,
        scoreD: 5,
        operator: "teacher",
      },
      {
        studentId: student.id,
        sessionId: currentSession.id,
        date: currentSession.date,
        scoreA: 5,
        scoreB: 4,
        scoreC: 4,
        scoreD: 5,
        operator: "teacher",
      },
    ],
  });
  await prisma.attendance.create({ data: { sessionId: currentSession.id, studentId: student.id, present: true } });
  await prisma.event.create({
    data: {
      sessionId: currentSession.id,
      studentId: student.id,
      type: "课堂表现",
      description: "主动订正错题",
      rawText: "主动订正错题",
    },
  });
  await prisma.communication.create({
    data: {
      sessionId: previousSession.id,
      studentId: student.id,
      target: "母亲",
      summary: "[企微长期沟通] 家长希望反馈时多强调进步和复盘方法。",
    },
  });
});

afterEach(async () => {
  await prisma.label.deleteMany({ where: { name: labelName } });
  if (semesterId) await prisma.semester.deleteMany({ where: { id: semesterId } });
  if (studentIds.length > 0) await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  if (classId) await prisma.class.deleteMany({ where: { id: classId } });
  classId = "";
  semesterId = "";
  studentIds = [];
  labelName = "";
  currentSessionCode = "";
});

describe("buildFeedbackContext", () => {
  it("combines current session, trends, communications and labels for feedback generation", async () => {
    const result = await buildFeedbackContext(prisma, currentSessionCode);
    const student = result.students.find((item) => item.id === studentIds[0]);

    expect(result.total).toBe(2);
    expect(student?.labels).toContain(labelName);
    expect(student?.preview.today.join("；")).toContain("主动订正错题");
    expect(student?.preview.trend).toContain("A3/B4/C3/D5");
    expect(student?.preview.communications.join("；")).toContain("家长希望反馈时多强调进步");
    expect(student?.promptContext).toContain(labelName);
    expect(student?.promptContext).toContain("近期家校沟通");
  });

  it("keeps students without historical records in the context without throwing", async () => {
    const result = await buildFeedbackContext(prisma, currentSessionCode);
    const student = result.students.find((item) => item.id === studentIds[1]);

    expect(student).toBeTruthy();
    expect(student?.preview.today.join("；")).toContain("无记录");
    expect(student?.preview.trend).toBe("暂无近期评分趋势");
    expect(student?.preview.communications).toEqual([]);
  });
});
