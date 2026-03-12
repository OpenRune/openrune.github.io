"use client";

import * as React from "react";

const QUERY = "(max-width: 767px)";

export function useIsMobile() {
  const subscribe = React.useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia(QUERY);
    mq.addEventListener("change", onStoreChange);
    return () => mq.removeEventListener("change", onStoreChange);
  }, []);

  const getSnapshot = React.useCallback(
    () => window.matchMedia(QUERY).matches,
    [],
  );

  const getServerSnapshot = React.useCallback(() => false, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
