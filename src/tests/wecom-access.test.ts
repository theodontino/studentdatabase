import { describe, expect, it, vi } from "vitest";
import {
  hasAcceptedWeComNotice,
  WECOM_ACCESS_NOTICE_VERSION,
  WECOM_ACCESS_STORAGE_KEY,
  writeWeComNoticeAcceptance,
} from "@/features/wecom-access";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("WeCom third-party notice access", () => {
  it("accepts only the current version with a valid timestamp", () => {
    const storage = memoryStorage();
    expect(hasAcceptedWeComNotice(storage)).toBe(false);

    storage.setItem(WECOM_ACCESS_STORAGE_KEY, JSON.stringify({ version: "old", acceptedAt: new Date().toISOString() }));
    expect(hasAcceptedWeComNotice(storage)).toBe(false);

    storage.setItem(WECOM_ACCESS_STORAGE_KEY, JSON.stringify({ version: WECOM_ACCESS_NOTICE_VERSION, acceptedAt: "invalid" }));
    expect(hasAcceptedWeComNotice(storage)).toBe(false);

    storage.setItem(WECOM_ACCESS_STORAGE_KEY, "not-json");
    expect(hasAcceptedWeComNotice(storage)).toBe(false);
  });

  it("writes a versioned acknowledgement and can revoke it", () => {
    const storage = memoryStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
    try {
      writeWeComNoticeAcceptance(storage, true);
      expect(JSON.parse(storage.getItem(WECOM_ACCESS_STORAGE_KEY) || "{}")).toEqual({
        version: WECOM_ACCESS_NOTICE_VERSION,
        acceptedAt: "2026-07-21T12:00:00.000Z",
      });
      expect(hasAcceptedWeComNotice(storage)).toBe(true);

      writeWeComNoticeAcceptance(storage, false);
      expect(storage.getItem(WECOM_ACCESS_STORAGE_KEY)).toBeNull();
      expect(hasAcceptedWeComNotice(storage)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recognizes an acknowledgement saved under the previous product key", () => {
    const storage = memoryStorage();
    storage.setItem("chem-track:wecom-access", JSON.stringify({
      version: WECOM_ACCESS_NOTICE_VERSION,
      acceptedAt: "2026-07-21T12:00:00.000Z",
    }));
    expect(hasAcceptedWeComNotice(storage)).toBe(true);
    writeWeComNoticeAcceptance(storage, false);
    expect(storage.getItem("chem-track:wecom-access")).toBeNull();
  });
});
