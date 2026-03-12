"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

import { TooltipProvider } from "@/components/ui/tooltip";
import { CacheTypeProvider } from "@/context/cache-type-context";
import { GamevalProvider } from "@/context/gameval-context";
import { SettingsProvider } from "@/context/settings-context";
import { ShellPreferencesProvider } from "@/context/shell-preferences-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider delay={0}>
        <CacheTypeProvider>
          <GamevalProvider>
            <ShellPreferencesProvider>
              <SettingsProvider>{children}</SettingsProvider>
            </ShellPreferencesProvider>
          </GamevalProvider>
        </CacheTypeProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
