import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseBackup } from "@/services/database-backup-service";

type Confidence = "high" | "medium" | "low";

interface WeComCandidateFile {
  records?: WeComRecord[];
}

interface WeComRecord {
  kind?: string;
  source?: {
    conversationId?: string | null;
    conversationTitle?: string | null;
  };
  matchedStudent?: {
    id?: string | null;
    name?: string | null;
    studentId?: string | null;
    confidence?: Confidence | string | null;
  };
  occurredAt?: string | null;
  sessionCode?: string | null;
  target?: string | null;
  summary?: string | null;
  summaryForChemTrack?: string | null;
  feedbackContext?: {
    toneHint?: string | null;
    nextAction?: string | null;
  } | null;
  confidence?: Confidence | string | null;
}

export interface WeComImportInput {
  jsonPath?: string;
  jsonText?: string;
  includeMedium?: boolean;
}

export interface WeComImportPlanItem {
  student: { id: string; name: string; studentId: string };
  session: { id: string; code: string; date: string; semesterNumber: number };
  source: { conversationId: string; conversationTitle: string };
  occurredAt: string;
  target: string;
  summary: string;
  duplicate: boolean;
  binding: "explicit_session" | "first_class_session_fallback";
}

export interface WeComImportSkippedItem {
  title: string;
  name: string;
  reason: string;
}

export interface WeComImportResult {
  sourceLabel: string;
  mode: "dry-run" | "apply";
  communicationCandidateCount: number;
  aiContextCandidateCount: number;
  importableCount: number;
  createCount: number;
  duplicateCount: number;
  skippedCount: number;
  createdCount: number;
  backupPath?: string;
  plans: WeComImportPlanItem[];
  skipped: WeComImportSkippedItem[];
}

interface InternalPlan extends WeComImportPlanItem {
  studentWithClass: { id: string; name: string; studentId: string; classId: string };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isAllowedConfidence(value: unknown, includeMedium: boolean) {
  return value === "high" || (includeMedium && value === "medium");
}

function buildSummary(record: WeComRecord) {
  const explicit = clean(record.summaryForChemTrack);
  if (explicit) return explicit;

  const occurredAt = clean(record.occurredAt) || "未知";
  const title = clean(record.source?.conversationTitle) || "未知会话";
  const body = clean(record.summary) || "企微家校沟通记录";
  const toneHint = clean(record.feedbackContext?.toneHint);
  const nextAction = clean(record.feedbackContext?.nextAction);
  const hints = [
    toneHint ? `反馈提示：${toneHint}` : "",
    nextAction ? `下一步：${nextAction}` : "",
  ].filter(Boolean).join("；");
  return `[企微长期沟通｜实际沟通: ${occurredAt}｜会话: ${title}] ${body}${hints ? `（${hints}）` : ""}`;
}

async function loadCandidateFile(input: WeComImportInput) {
  if (input.jsonText?.trim()) {
    return {
      data: JSON.parse(input.jsonText) as WeComCandidateFile,
      sourceLabel: "上传的 JSON",
    };
  }
  const jsonPath = clean(input.jsonPath);
  if (!jsonPath) throw new Error("缺少 JSON 文件路径或上传内容");
  const resolvedPath = resolve(jsonPath);
  return {
    data: JSON.parse(await readFile(resolvedPath, "utf8")) as WeComCandidateFile,
    sourceLabel: resolvedPath,
  };
}

async function findMatchedStudent(prisma: PrismaClient, record: WeComRecord) {
  const matched = record.matchedStudent;
  if (!matched) return { student: null, reason: "missing_matched_student" };

  const id = clean(matched.id);
  if (id) {
    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, name: true, studentId: true, classId: true },
    });
    return student ? { student, reason: "" } : { student: null, reason: "student_id_not_found" };
  }

  const studentId = clean(matched.studentId);
  if (studentId) {
    const student = await prisma.student.findUnique({
      where: { studentId },
      select: { id: true, name: true, studentId: true, classId: true },
    });
    if (student) return { student, reason: "" };
  }

  const name = clean(matched.name);
  if (!name) return { student: null, reason: "missing_student_name" };
  const students = await prisma.student.findMany({
    where: { name },
    select: { id: true, name: true, studentId: true, classId: true },
  });
  if (students.length === 1) return { student: students[0], reason: "" };
  if (students.length > 1) return { student: null, reason: "ambiguous_student_name" };
  return { student: null, reason: "student_not_found" };
}

async function resolveSession(prisma: PrismaClient, record: WeComRecord, student: { classId: string }) {
  const sessionCode = clean(record.sessionCode);
  if (sessionCode) {
    const session = await prisma.classSession.findUnique({
      where: { code: sessionCode },
      select: { id: true, code: true, date: true, semesterNumber: true, classId: true },
    });
    if (!session) return { session: null, binding: "explicit_session" as const, reason: "session_not_found" };
    if (session.classId && session.classId !== student.classId) {
      return { session: null, binding: "explicit_session" as const, reason: "session_class_mismatch" };
    }
    return { session, binding: "explicit_session" as const, reason: "" };
  }

  const session = await prisma.classSession.findFirst({
    where: { classId: student.classId },
    select: { id: true, code: true, date: true, semesterNumber: true },
    orderBy: [{ date: "asc" }, { semesterNumber: "asc" }, { createdAt: "asc" }],
  });
  return session
    ? { session, binding: "first_class_session_fallback" as const, reason: "" }
    : { session: null, binding: "first_class_session_fallback" as const, reason: "fallback_session_not_found" };
}

function publicPlan(plan: InternalPlan): WeComImportPlanItem {
  return {
    student: plan.student,
    session: plan.session,
    source: plan.source,
    occurredAt: plan.occurredAt,
    target: plan.target,
    summary: plan.summary,
    duplicate: plan.duplicate,
    binding: plan.binding,
  };
}

export async function planWeComCommunicationImport(
  prisma: PrismaClient,
  input: WeComImportInput
): Promise<WeComImportResult> {
  const { data, sourceLabel } = await loadCandidateFile(input);
  const records = Array.isArray(data.records) ? data.records : [];
  const communicationRecords = records.filter((record) => record.kind === "communication");
  const aiContextCandidateCount = records.filter((record) => record.kind === "aiContext").length;
  const includeMedium = input.includeMedium === true;
  const skipped: WeComImportSkippedItem[] = [];
  const internalPlans: InternalPlan[] = [];

  for (const record of communicationRecords) {
    const title = clean(record.source?.conversationTitle);
    const name = clean(record.matchedStudent?.name);
    if (!isAllowedConfidence(record.matchedStudent?.confidence, includeMedium)) {
      skipped.push({ title, name, reason: "matched_student_confidence_not_allowed" });
      continue;
    }

    const { student, reason: studentReason } = await findMatchedStudent(prisma, record);
    if (!student) {
      skipped.push({ title, name, reason: studentReason });
      continue;
    }

    const { session, binding, reason: sessionReason } = await resolveSession(prisma, record, student);
    if (!session) {
      skipped.push({ title, name: student.name, reason: sessionReason });
      continue;
    }

    const target = clean(record.target) || "家长";
    const summary = buildSummary(record);
    const duplicate = Boolean(await prisma.communication.findFirst({
      where: { studentId: student.id, sessionId: session.id, summary },
      select: { id: true },
    }));
    internalPlans.push({
      studentWithClass: student,
      student: { id: student.id, name: student.name, studentId: student.studentId },
      session,
      source: {
        conversationId: clean(record.source?.conversationId),
        conversationTitle: title,
      },
      occurredAt: clean(record.occurredAt),
      target,
      summary,
      duplicate,
      binding,
    });
  }

  const plans = internalPlans.map(publicPlan);
  const createCount = plans.filter((plan) => !plan.duplicate).length;
  return {
    sourceLabel,
    mode: "dry-run",
    communicationCandidateCount: communicationRecords.length,
    aiContextCandidateCount,
    importableCount: plans.length,
    createCount,
    duplicateCount: plans.length - createCount,
    skippedCount: skipped.length,
    createdCount: 0,
    plans,
    skipped,
  };
}

export async function applyWeComCommunicationImport(
  prisma: PrismaClient,
  input: WeComImportInput & { skipBackup?: boolean }
): Promise<WeComImportResult> {
  const planned = await planWeComCommunicationImport(prisma, input);
  const createPlans = planned.plans.filter((plan) => !plan.duplicate);
  let backupPath: string | undefined;
  if (createPlans.length > 0 && input.skipBackup !== true) {
    backupPath = (await createDatabaseBackup({ prefix: "pre-wecom-import" })).backupPath;
  }

  await prisma.$transaction(async (tx) => {
    for (const plan of createPlans) {
      await tx.communication.create({
        data: {
          studentId: plan.student.id,
          sessionId: plan.session.id,
          target: plan.target,
          summary: plan.summary,
        },
      });
    }
  });

  return {
    ...planned,
    mode: "apply",
    createdCount: createPlans.length,
    backupPath,
    plans: planned.plans.map((plan) => ({ ...plan, duplicate: plan.duplicate || !createPlans.includes(plan) })),
  };
}
