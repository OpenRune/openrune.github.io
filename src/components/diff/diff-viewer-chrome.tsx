"use client";

import * as React from "react";

type DiffViewerChromeSlotValue = {
  slotEl: HTMLElement | null;
  setSlotEl: (el: HTMLElement | null) => void;
};

const DiffViewerChromeSlotContext = React.createContext<DiffViewerChromeSlotValue | null>(null);

export function DiffViewerChromeProvider({ children }: { children: React.ReactNode }) {
  const [slotEl, setSlotEl] = React.useState<HTMLElement | null>(null);
  const value = React.useMemo(() => ({ slotEl, setSlotEl }), [slotEl]);
  return (
    <DiffViewerChromeSlotContext.Provider value={value}>{children}</DiffViewerChromeSlotContext.Provider>
  );
}

export function DiffViewerChromeSlot({ className }: { className?: string }) {
  const ctx = React.useContext(DiffViewerChromeSlotContext);
  const setSlotEl = ctx?.setSlotEl;
  const ref = React.useCallback(
    (node: HTMLDivElement | null) => {
      setSlotEl?.(node);
    },
    [setSlotEl],
  );
  if (!ctx) return null;
  return <div ref={ref} className={className} data-diff-viewer-chrome-slot="" />;
}

export function useDiffViewerChromeSlot() {
  return React.useContext(DiffViewerChromeSlotContext);
}
