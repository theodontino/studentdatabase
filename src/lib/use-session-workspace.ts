"use client";

import { useEffect, useRef, useState } from "react";
import {
  readSessionWorkspace,
  removeSessionWorkspace,
  writeSessionWorkspace,
} from "./session-workspace";

interface SessionWorkspaceOptions<T> {
  key: string;
  value: T;
  restore: (value: T | null) => void;
  validate: (value: unknown) => value is T;
  version?: number;
  enabled?: boolean;
}

export function useSessionWorkspace<T>({
  key,
  value,
  restore,
  validate,
  version = 1,
  enabled = true,
}: SessionWorkspaceOptions<T>) {
  const restoreRef = useRef(restore);
  const validateRef = useRef(validate);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  useEffect(() => {
    restoreRef.current = restore;
    validateRef.current = validate;
  }, [restore, validate]);

  useEffect(() => {
    if (!enabled) {
      setHydratedKey(null);
      return;
    }
    const envelope = readSessionWorkspace(window.sessionStorage, key, version, validateRef.current);
    restoreRef.current(envelope?.value ?? null);
    setRestoredAt(envelope?.savedAt ?? null);
    setHydratedKey(key);
  }, [enabled, key, version]);

  useEffect(() => {
    if (!enabled || hydratedKey !== key) return;
    writeSessionWorkspace(window.sessionStorage, key, version, value);
  }, [enabled, hydratedKey, key, value, version]);

  return {
    hydrated: enabled && hydratedKey === key,
    restoredAt,
    clear() {
      removeSessionWorkspace(window.sessionStorage, key);
      setRestoredAt(null);
    },
  };
}
