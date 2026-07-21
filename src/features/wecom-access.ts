export const WECOM_ACCESS_STORAGE_KEY = "chem-track:wecom-access";
export const WECOM_ACCESS_EVENT = "chem-track:wecom-access-change";
export const WECOM_ACCESS_NOTICE_VERSION = "wecom-third-party-notice-v1";

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function hasAcceptedWeComNotice(storage: StorageReader | null | undefined) {
  if (!storage) return false;
  try {
    const parsed = JSON.parse(storage.getItem(WECOM_ACCESS_STORAGE_KEY) || "null") as unknown;
    if (!parsed || typeof parsed !== "object") return false;
    const record = parsed as { version?: unknown; acceptedAt?: unknown };
    return record.version === WECOM_ACCESS_NOTICE_VERSION
      && typeof record.acceptedAt === "string"
      && !Number.isNaN(Date.parse(record.acceptedAt));
  } catch {
    return false;
  }
}

export function writeWeComNoticeAcceptance(storage: StorageWriter, accepted: boolean) {
  if (!accepted) {
    storage.removeItem(WECOM_ACCESS_STORAGE_KEY);
    return;
  }
  storage.setItem(WECOM_ACCESS_STORAGE_KEY, JSON.stringify({
    version: WECOM_ACCESS_NOTICE_VERSION,
    acceptedAt: new Date().toISOString(),
  }));
}

export function notifyWeComAccessChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WECOM_ACCESS_EVENT));
}
