import { describe, expect, it } from "vitest";
import {
  readSessionWorkspace,
  removeSessionWorkspace,
  sessionWorkspaceKey,
  writeSessionWorkspace,
} from "@/lib/session-workspace";

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() { return items.size; },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => { items.delete(key); },
    setItem: (key, value) => { items.set(key, value); },
  };
}

interface Fixture { text: string; count: number; }
function isFixture(value: unknown): value is Fixture {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Fixture>;
  return typeof item.text === "string" && typeof item.count === "number";
}

describe("session workspace", () => {
  it("writes and reads a versioned workspace value", () => {
    const storage = memoryStorage();
    writeSessionWorkspace(storage, "input", 2, { text: "draft", count: 3 });
    expect(readSessionWorkspace(storage, "input", 2, isFixture)?.value).toEqual({ text: "draft", count: 3 });
    expect(storage.getItem(sessionWorkspaceKey("input"))).toContain('"version":2');
  });

  it("rejects stale versions, invalid values, and malformed JSON", () => {
    const storage = memoryStorage();
    writeSessionWorkspace(storage, "input", 1, { text: "draft", count: 3 });
    expect(readSessionWorkspace(storage, "input", 2, isFixture)).toBeNull();
    storage.setItem(sessionWorkspaceKey("input"), JSON.stringify({ version: 2, savedAt: new Date().toISOString(), value: { text: 4 } }));
    expect(readSessionWorkspace(storage, "input", 2, isFixture)).toBeNull();
    storage.setItem(sessionWorkspaceKey("input"), "not-json");
    expect(readSessionWorkspace(storage, "input", 2, isFixture)).toBeNull();
  });

  it("removes only the requested workspace", () => {
    const storage = memoryStorage();
    writeSessionWorkspace(storage, "input", 1, { text: "one", count: 1 });
    writeSessionWorkspace(storage, "feedback", 1, { text: "two", count: 2 });
    removeSessionWorkspace(storage, "input");
    expect(storage.getItem(sessionWorkspaceKey("input"))).toBeNull();
    expect(storage.getItem(sessionWorkspaceKey("feedback"))).not.toBeNull();
  });
});
