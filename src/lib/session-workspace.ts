const WORKSPACE_PREFIX = "chem-track:workspace:";

export interface SessionWorkspaceEnvelope<T> {
  version: number;
  savedAt: string;
  value: T;
}

export function sessionWorkspaceKey(key: string) {
  return `${WORKSPACE_PREFIX}${key}`;
}

export function readSessionWorkspace<T>(
  storage: Storage,
  key: string,
  version: number,
  validate: (value: unknown) => value is T,
): SessionWorkspaceEnvelope<T> | null {
  try {
    const raw = storage.getItem(sessionWorkspaceKey(key));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const envelope = parsed as Partial<SessionWorkspaceEnvelope<unknown>>;
    if (envelope.version !== version || typeof envelope.savedAt !== "string" || !validate(envelope.value)) {
      return null;
    }
    return envelope as SessionWorkspaceEnvelope<T>;
  } catch {
    return null;
  }
}

export function writeSessionWorkspace<T>(
  storage: Storage,
  key: string,
  version: number,
  value: T,
): SessionWorkspaceEnvelope<T> | null {
  const envelope: SessionWorkspaceEnvelope<T> = {
    version,
    savedAt: new Date().toISOString(),
    value,
  };
  try {
    storage.setItem(sessionWorkspaceKey(key), JSON.stringify(envelope));
    return envelope;
  } catch {
    return null;
  }
}

export function removeSessionWorkspace(storage: Storage, key: string) {
  try {
    storage.removeItem(sessionWorkspaceKey(key));
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
