import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

let sessionId: string;

beforeAll(async () => {
  const ses = await prisma.classSession.findFirst({ select: { id: true } });
  sessionId = ses!.id;
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

  it("GET without sessionId returns 400", async () => {
    const { GET } = await import("@/app/api/attendance/route");
    const req = new NextRequest("http://localhost:3000/api/attendance");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
