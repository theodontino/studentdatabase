"use client";

import { useCallback, useEffect, useState } from "react";
import {
  hasAcceptedWeComNotice,
  notifyWeComAccessChange,
  WECOM_ACCESS_EVENT,
  WECOM_ACCESS_STORAGE_KEY,
  writeWeComNoticeAcceptance,
} from "./wecom-access";

export function useWeComAccess() {
  const [hydrated, setHydrated] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const sync = useCallback(() => {
    setEnabled(hasAcceptedWeComNotice(window.localStorage));
    setHydrated(true);
  }, []);

  useEffect(() => {
    sync();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === WECOM_ACCESS_STORAGE_KEY) sync();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(WECOM_ACCESS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(WECOM_ACCESS_EVENT, sync);
    };
  }, [sync]);

  const setAccess = useCallback((accepted: boolean) => {
    writeWeComNoticeAcceptance(window.localStorage, accepted);
    notifyWeComAccessChange();
  }, []);

  return { hydrated, enabled, setAccess };
}
