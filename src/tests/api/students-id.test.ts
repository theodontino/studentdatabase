import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

let testStudent: { id: string; name: string; studentId: string };

beforeAll(async () => {
  const student = await prisma.student.findFirst({
    select: { id: true, name: true, studentId: true },
    orderBy: { studentId: "asc" },
  });
  expect(student).toBeTruthy();
  testStudent = student!;
});

describe("/api/students/[id]", () => {
  it("GET returns 200 with student detail", async () => {
    const { GET } = await import("@/app/api/students/[id]/route");
    const req = new NextRequest(`http://localhost:3000/api/students/${testStudent.id}`);
    const res = await GET(req, { params: Promise.resolve({ id: testStudent.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("name", testStudent.name);
    expect(body).toHaveProperty("studentId", testStudent.studentId);
    expect(body).toHaveProperty("sessionMetrics");
    expect(body).toHaveProperty("events");
  });

  it("GET nonexistent id returns 404", async () => {
    const { GET } = await import("@/app/api/students/[id]/route");
    const req = new NextRequest("http://localhost:3000/api/students/nonexistent");
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("PUT returns 200 and updates labels", async () => {
    const { PUT } = await import("@/app/api/students/[id]/route");
    const req = new NextRequest(`http://localhost:3000/api/students/${testStudent.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels: ["#逻辑强", "#基础扎实", "#学霸"] }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: testStudent.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("name", testStudent.name);
  });
});
