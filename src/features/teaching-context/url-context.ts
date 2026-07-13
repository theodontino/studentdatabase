import type { TeachingContext } from "./types";

export const emptyTeachingContext: TeachingContext = { semesterId: "", className: "", sessionCode: "" };
export const TEACHING_CONTEXT_STORAGE_KEY = "chem-track:teaching-context";

export function isTeachingContext(value: unknown): value is TeachingContext {
  if (!value || typeof value !== "object") return false;
  const context = value as Partial<TeachingContext>;
  return typeof context.semesterId === "string"
    && typeof context.className === "string"
    && typeof context.sessionCode === "string";
}

export function parseTeachingContext(search: string): TeachingContext {
  const params = new URLSearchParams(search);
  return { semesterId: params.get("semesterId") ?? "", className: params.get("class") ?? "", sessionCode: params.get("sessionCode") ?? "" };
}

export function applyTeachingContext(url: URL, context: TeachingContext): URL {
  const next = new URL(url);
  const values: Array<[string, string]> = [["semesterId", context.semesterId], ["class", context.className], ["sessionCode", context.sessionCode]];
  for (const [key, value] of values) {
    if (value) next.searchParams.set(key, value);
    else next.searchParams.delete(key);
  }
  return next;
}

export function hasTeachingContext(search: string) {
  const params = new URLSearchParams(search);
  return ["semesterId", "class", "sessionCode"].some((key) => params.has(key));
}

export function readStoredTeachingContext(storage: Storage): TeachingContext | null {
  try {
    const raw = storage.getItem(TEACHING_CONTEXT_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isTeachingContext(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredTeachingContext(storage: Storage, context: TeachingContext) {
  try {
    storage.setItem(TEACHING_CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // URL state remains available when session storage is unavailable.
  }
}

export function teachingContextWorkspaceKey(scope: string, context: TeachingContext) {
  const contextKey = [context.semesterId, context.className, context.sessionCode]
    .map((value) => encodeURIComponent(value))
    .join("|");
  return `${scope}:${contextKey}`;
}
