import { describe, expect, it } from "vitest";
import {
  applyTeachingContext,
  hasTeachingContext,
  parseTeachingContext,
  readStoredTeachingContext,
  teachingContextWorkspaceKey,
  writeStoredTeachingContext,
} from "@/features/teaching-context/url-context";

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() { return items.size; }, clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null, key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => { items.delete(key); }, setItem: (key, value) => { items.set(key, value); },
  };
}

describe("teaching context URL", () => {
  it("reads the stable query parameter names", () => {
    expect(parseTeachingContext("?semesterId=sem-1&class=高一A班&sessionCode=S03")).toEqual({ semesterId: "sem-1", className: "高一A班", sessionCode: "S03" });
  });
  it("updates context without dropping unrelated parameters", () => {
    const url = applyTeachingContext(new URL("http://127.0.0.1:3000/entry?step=review&class=old"), { semesterId: "sem-2", className: "", sessionCode: "" });
    expect(url.searchParams.get("step")).toBe("review");
    expect(url.searchParams.get("semesterId")).toBe("sem-2");
    expect(url.searchParams.has("class")).toBe(false);
  });
  it("stores the latest context for cross-page navigation", () => {
    const storage = memoryStorage();
    const context = { semesterId: "sem-2", className: "高一A班", sessionCode: "S04" };
    writeStoredTeachingContext(storage, context);
    expect(readStoredTeachingContext(storage)).toEqual(context);
    expect(hasTeachingContext("?step=review")).toBe(false);
    expect(hasTeachingContext("?step=review&semesterId=sem-2")).toBe(true);
  });
  it("isolates page workspaces by the full teaching context", () => {
    const first = teachingContextWorkspaceKey("feedback", { semesterId: "sem-2", className: "高一 A/班", sessionCode: "S04" });
    const second = teachingContextWorkspaceKey("feedback", { semesterId: "sem-2", className: "高一 A/班", sessionCode: "S05" });
    expect(first).toBe("feedback:sem-2|%E9%AB%98%E4%B8%80%20A%2F%E7%8F%AD|S04");
    expect(second).not.toBe(first);
  });
});
