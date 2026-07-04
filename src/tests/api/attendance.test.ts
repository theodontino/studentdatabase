import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

let sessionId: string;
let studentId: string;

beforeAll(async () => {
  const ses = await prisma.classSession.findFirst({ select: { id: true } });
  sessionId = ses!.id;
  const attendance = await prisma.attendance.findFirst({ select: { studentId: true } });
  studentId = attendance!.studentId;
});

describe("/api/attendance", () => {
  it("GET with sessionId returns 200 with array", async () => {
    const { GET } = await import("@/app/api/attendance/route");
    const url = `http://localhost:3000/api/attendance?sessionId=${sessionId}`;
    const req = new NextRequest(url);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("GET with studentId returns attendance history with session info", async () => {
    const { GET } = await import("@/app/api/attendance/route");
    const url = `http://localhost:3000/api/attendance?studentId=${studentId}`;
    const req = new NextRequest(url);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty("studentId", studentId);
    expect(body[0]).toHaveProperty("session");
    expect(body[0].session).toHaveProperty("date");
    expect(body[0].session).toHaveProperty("semesterNumber");
  });

  it("GET without query id returns 400", async () => {
    const { GET } = await import("@/app/api/attendance/route");
    const req = new NextRequest("http://localhost:3000/api/attendance");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
