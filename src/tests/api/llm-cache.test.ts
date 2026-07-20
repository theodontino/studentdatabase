import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET } from "@/app/api/system/llm-cache/route";
import { llmCacheFetch, withLLMCacheOperation } from "@/services/llm-cache-service";

describe.sequential("/api/system/llm-cache", () => {
  let root = "";
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "llm-cache-api-"));
    vi.stubEnv("LLM_CACHE_ROOT", root);
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
  });

  it("returns only operation metadata and clears selected non-active cache", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: "private-model-output" } }],
    }))) as typeof fetch;
    await withLLMCacheOperation("wecom", "企微提取", async () => {
      const response = await llmCacheFetch("http://localhost", {
        method: "POST",
        body: JSON.stringify({ messages: [{ role: "user", content: "private-chat-input" }] }),
      });
      await response.text();
    });

    const response = await GET();
    const text = await response.text();
    const payload = JSON.parse(text);
    expect(payload.operations).toHaveLength(1);
    expect(payload.operations[0]).toMatchObject({ taskType: "wecom", callCount: 1, status: "succeeded" });
    expect(text).not.toContain("private-chat-input");
    expect(text).not.toContain("private-model-output");

    const cleared = await DELETE(new NextRequest("http://localhost/api/system/llm-cache?taskType=wecom", {
      method: "DELETE",
    }));
    await expect(cleared.json()).resolves.toEqual({ removed: 1 });
    await expect(GET().then((result) => result.json())).resolves.toMatchObject({ operations: [] });
  });

  it("rejects unknown task types", async () => {
    const response = await DELETE(new NextRequest("http://localhost/api/system/llm-cache?taskType=unknown", {
      method: "DELETE",
    }));
    expect(response.status).toBe(400);
  });
});
