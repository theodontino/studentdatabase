import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/export/route";

describe("/api/export", () => {
  it("POST without dates returns 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST with dates returns 200 with xlsx", async () => {
    const req = new NextRequest("http://localhost:3000/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: "2026-06-01", endDate: "2026-06-10" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  });
});
