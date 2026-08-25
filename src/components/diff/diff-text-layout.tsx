"use client";

import * as React from "react";

export type DiffTextLayout = "unified" | "split";

type DiffTextLayoutValue = {
  diffLayout: DiffTextLayout;
  setDiffLayout: (layout: DiffTextLayout) => void;
};

const DiffTextLayoutContext = React.createContext<DiffTextLayoutValue | null>(null);

const STORAGE_KEY = "openrune.diff-explorer.text-layout.v1";

function readStoredLayout(): DiffTextLayout {
  if (typeof window === "undefined") return "split";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "unified" || raw === "split") return raw;
  } catch {
    // ignore
  }
  return "split";
}

export function DiffTextLayoutProvider({ children }: { children: React.ReactNode }) {
  const [diffLayout, setDiffLayoutState] = React.useState<DiffTextLayout>("split");

  React.useEffect(() => {
    setDiffLayoutState(readStoredLayout());
  }, []);

  const setDiffLayout = React.useCallback((layout: DiffTextLayout) => {
    setDiffLayoutState(layout);
    try {
      window.localStorage.setItem(STORAGE_KEY, layout);
    } catch {
      // ignore
    }
  }, []);

  const value = React.useMemo(() => ({ diffLayout, setDiffLayout }), [diffLayout, setDiffLayout]);
  return <DiffTextLayoutContext.Provider value={value}>{children}</DiffTextLayoutContext.Provider>;
}

export function useDiffTextLayout(): DiffTextLayoutValue {
  const ctx = React.useContext(DiffTextLayoutContext);
  if (!ctx) {
    throw new Error("useDiffTextLayout must be used within DiffTextLayoutProvider");
  }
  return ctx;
}

/** Optional: views may fall back to local state outside the explorer. */
export function useDiffTextLayoutOptional(): DiffTextLayoutValue | null {
  return React.useContext(DiffTextLayoutContext);
}
