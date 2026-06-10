import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

let studentId: string;

beforeAll(async () => {
  const s = await prisma.student.findFirst({ where: { name: "张三" }, select: { id: true } });
  studentId = s!.id;
});

describe("/api/students/[id]/history", () => {
  it("GET returns 200 with array", async () => {
    const { GET } = await import("@/app/api/students/[id]/history/route");
    const req = new NextRequest(`http://localhost:3000/api/students/${studentId}/history`);
    const res = await GET(req, { params: Promise.resolve({ id: studentId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
