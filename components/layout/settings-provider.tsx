'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface Settings {
  copyGamevalsToUppercase: boolean;
  fullWidthContent: boolean;
  allowMultipleCollapsiblesOpen: boolean;
  navItemSize: 'small' | 'medium' | 'large';
  suggestionDisplay: {
    objects: boolean;
    items: boolean;
    npcs: boolean;
    sprites: boolean;
    sequences: boolean;
    spotanims: boolean;
    textures: boolean;
    underlaysOverlays: boolean;
  };
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    copyGamevalsToUppercase: false,
    fullWidthContent: true,
    allowMultipleCollapsiblesOpen: true,
    navItemSize: 'medium',
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
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('app-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        // Merge with defaults, ensuring suggestionDisplay is properly initialized
        setSettings(prev => ({
          ...prev,
          ...parsed,
          suggestionDisplay: {
            ...prev.suggestionDisplay,
            ...(parsed.suggestionDisplay || {}),
          },
        }));
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('app-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => {
      // Handle nested suggestionDisplay updates
      if (newSettings.suggestionDisplay && prev.suggestionDisplay) {
        return {
          ...prev,
          ...newSettings,
          suggestionDisplay: {
            ...prev.suggestionDisplay,
            ...newSettings.suggestionDisplay,
          },
        };
      }
      return { ...prev, ...newSettings };
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
} 