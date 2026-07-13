"use client";

import { useEffect } from "react";

export function useUnsavedNavigationWarning(when: boolean, message: string) {
  useEffect(() => {
    if (!when) return;

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function confirmAnchorNavigation(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) return;
      if (window.confirm(message)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", confirmAnchorNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", confirmAnchorNavigation, true);
    };
  }, [message, when]);
}
