"use client";

import * as React from "react";

const STORAGE_SIDEBAR = "openrune-sidebar-collapsed";

type ShellPreferencesContextValue = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebarCollapsed: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
};

const ShellPreferencesContext =
  React.createContext<ShellPreferencesContextValue | null>(null);

function readStorage<T>(key: string, fallback: T, parse: (raw: string) => T) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return parse(raw);
  } catch {
    return fallback;
  }
}

export function ShellPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hydrated, setHydrated] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    setSidebarCollapsedState(
      readStorage(STORAGE_SIDEBAR, false, (raw) => raw === "true"),
    );
    setHydrated(true);
  }, []);

  const setSidebarCollapsed = React.useCallback((v: boolean) => {
    setSidebarCollapsedState(v);
    try {
      localStorage.setItem(STORAGE_SIDEBAR, String(v));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebarCollapsed = React.useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_SIDEBAR, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      mobileNavOpen,
      setMobileNavOpen,
    }),
    [
      mobileNavOpen,
      setSidebarCollapsed,
      sidebarCollapsed,
      toggleSidebarCollapsed,
    ],
  );

  return (
    <ShellPreferencesContext.Provider value={value}>
      {children}
    </ShellPreferencesContext.Provider>
  );
}

export function useShellPreferences() {
  const ctx = React.useContext(ShellPreferencesContext);
  if (!ctx) {
    throw new Error("useShellPreferences must be used within ShellPreferencesProvider");
  }
  return ctx;
}
