"use client";

import * as React from "react";

const STORAGE_SETTINGS = "openrune-app-settings";

export type NavItemSize = "small" | "medium" | "large";
export type ThemePreset =
  | "default"
  | "blue"
  | "green"
  | "amber"
  | "default-scaled"
  | "blue-scaled"
  | "mono-scaled";

export type SuggestionDisplay = {
  objects: boolean;
  items: boolean;
  npcs: boolean;
  sprites: boolean;
  sequences: boolean;
  spotanims: boolean;
  textures: boolean;
  underlaysOverlays: boolean;
};

export type AppSettings = {
  copyGamevalsToUppercase: boolean;
  fullWidthContent: boolean;
  allowMultipleCollapsiblesOpen: boolean;
  diffTextViewPreviews: boolean;
  navItemSize: NavItemSize;
  themePreset: ThemePreset;
  suggestionDisplay: SuggestionDisplay;
};

type SettingsContextValue = {
  settings: AppSettings;
  hydrated: boolean;
  updateSettings: (next: Partial<AppSettings>) => void;
  updateSuggestionDisplay: (key: keyof SuggestionDisplay, value: boolean) => void;
};

const defaultSettings: AppSettings = {
  copyGamevalsToUppercase: false,
  fullWidthContent: true,
  allowMultipleCollapsiblesOpen: true,
  diffTextViewPreviews: true,
  navItemSize: "medium",
  themePreset: "default",
  suggestionDisplay: {
    objects: true,
    items: true,
    npcs: true,
    sprites: true,
    sequences: true,
    spotanims: true,
    textures: true,
    underlaysOverlays: true,
  },
};

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<AppSettings>(defaultSettings);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      setSettings((prev) => ({
        ...prev,
        ...parsed,
        suggestionDisplay: {
          ...prev.suggestionDisplay,
          ...(parsed.suggestionDisplay ?? {}),
        },
      }));
    } catch {
      // Ignore malformed local storage and keep defaults.
    } finally {
      setHydrated(true);
    }
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore storage write errors.
    }
  }, [hydrated, settings]);

  React.useEffect(() => {
    if (!hydrated) return;
    const body = document.body;
    const themeClasses = Array.from(body.classList).filter((c) => c.startsWith("theme-"));
    themeClasses.forEach((c) => body.classList.remove(c));
    body.classList.add(`theme-${settings.themePreset}`);
    if (settings.themePreset.endsWith("-scaled")) {
      body.classList.add("theme-scaled");
    } else {
      body.classList.remove("theme-scaled");
    }
  }, [hydrated, settings.themePreset]);

  React.useEffect(() => {
    if (!hydrated) return;
    document.body.classList.toggle("full-width-content", settings.fullWidthContent);
  }, [hydrated, settings.fullWidthContent]);

  const updateSettings = React.useCallback((next: Partial<AppSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...next,
      suggestionDisplay: {
        ...prev.suggestionDisplay,
        ...(next.suggestionDisplay ?? {}),
      },
    }));
  }, []);

  const updateSuggestionDisplay = React.useCallback(
    (key: keyof SuggestionDisplay, value: boolean) => {
      setSettings((prev) => ({
        ...prev,
        suggestionDisplay: {
          ...prev.suggestionDisplay,
          [key]: value,
        },
      }));
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      settings,
      hydrated,
      updateSettings,
      updateSuggestionDisplay,
    }),
    [hydrated, settings, updateSettings, updateSuggestionDisplay],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = React.useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
