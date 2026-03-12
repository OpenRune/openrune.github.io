"use client";

import * as React from "react";
import { IconMoon, IconSettings, IconSun } from "@tabler/icons-react";
import { Check } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ThemePreset } from "@/context/settings-context";
import { useSettings } from "@/context/settings-context";

type SettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DEFAULT_THEMES: Array<{ name: string; value: ThemePreset }> = [
  { name: "Default", value: "default" },
  { name: "Blue", value: "blue" },
  { name: "Green", value: "green" },
  { name: "Amber", value: "amber" },
];

const SCALED_THEMES: Array<{ name: string; value: ThemePreset }> = [
  { name: "Default", value: "default-scaled" },
  { name: "Blue", value: "blue-scaled" },
];

const MONO_THEMES: Array<{ name: string; value: ThemePreset }> = [
  { name: "Mono", value: "mono-scaled" },
];

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { settings, updateSettings, updateSuggestionDisplay } = useSettings();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeToggle = React.useCallback(() => {
    const newMode = resolvedTheme === "dark" ? "light" : "dark";

    if (!document.startViewTransition) {
      setTheme(newMode);
      return;
    }

    document.startViewTransition(() => {
      setTheme(newMode);
    });
  }, [resolvedTheme, setTheme]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconSettings size={20} />
            Settings
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="suggestion-display">Suggestion Display</TabsTrigger>
            <TabsTrigger value="themes">Themes</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Dark / Light Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Toggle between dark and light color schemes
                </p>
              </div>
              {mounted && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleThemeToggle}
                  className="h-10 w-10"
                  aria-label="Toggle dark/light mode"
                >
                  {resolvedTheme === "dark" ? (
                    <IconSun className="h-5 w-5" />
                  ) : (
                    <IconMoon className="h-5 w-5" />
                  )}
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="copy-gamevals-uppercase">Copy Gamevals to uppercase</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, any selected text that appears to be a gameval will be
                  automatically converted to uppercase when copied
                </p>
              </div>
              <Switch
                id="copy-gamevals-uppercase"
                checked={settings.copyGamevalsToUppercase}
                onCheckedChange={(value) => updateSettings({ copyGamevalsToUppercase: value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="full-width-content">Full width content</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, page content will use the full available width instead of
                  being constrained to a maximum width
                </p>
              </div>
              <Switch
                id="full-width-content"
                checked={settings.fullWidthContent}
                onCheckedChange={(value) => updateSettings({ fullWidthContent: value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="allow-multiple-collapsibles">
                  Allow multiple sidebar sections open
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, you can have multiple sidebar navigation sections open at
                  the same time. When disabled, opening one section will close others.
                </p>
              </div>
              <Switch
                id="allow-multiple-collapsibles"
                checked={settings.allowMultipleCollapsiblesOpen}
                onCheckedChange={(value) =>
                  updateSettings({ allowMultipleCollapsiblesOpen: value })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="diff-text-view-previews">
                  Show color and texture previews in diff text view
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, config text view shows color boxes and texture thumbnails
                  next to colour/texture values (overlays, underlays, textures,
                  modifiedColours, etc.)
                </p>
              </div>
              <Switch
                id="diff-text-view-previews"
                checked={settings.diffTextViewPreviews}
                onCheckedChange={(value) => updateSettings({ diffTextViewPreviews: value })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Navigation item size</Label>
                <p className="text-sm text-muted-foreground">
                  Control the size of sidebar navigation items
                </p>
              </div>
              <div className="flex items-center gap-2" role="group" aria-label="Navigation item size">
                <Button
                  variant={settings.navItemSize === "small" ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-3 text-sm"
                  onClick={() => updateSettings({ navItemSize: "small" })}
                  aria-pressed={settings.navItemSize === "small"}
                >
                  Small
                </Button>
                <Button
                  variant={settings.navItemSize === "medium" ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-3 text-sm"
                  onClick={() => updateSettings({ navItemSize: "medium" })}
                  aria-pressed={settings.navItemSize === "medium"}
                >
                  Medium
                </Button>
                <Button
                  variant={settings.navItemSize === "large" ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-3 text-sm"
                  onClick={() => updateSettings({ navItemSize: "large" })}
                  aria-pressed={settings.navItemSize === "large"}
                >
                  Large
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="suggestion-display" className="space-y-6 mt-4">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold mb-3 block">Table Suggestions</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Control whether suggestions are displayed when searching in each table
                  page.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="suggestions-objects">Objects</Label>
                    <Switch
                      id="suggestions-objects"
                      checked={settings.suggestionDisplay.objects}
                      onCheckedChange={(value) => updateSuggestionDisplay("objects", value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="suggestions-items">Items</Label>
                    <Switch
                      id="suggestions-items"
                      checked={settings.suggestionDisplay.items}
                      onCheckedChange={(value) => updateSuggestionDisplay("items", value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="suggestions-npcs">NPCs</Label>
                    <Switch
                      id="suggestions-npcs"
                      checked={settings.suggestionDisplay.npcs}
                      onCheckedChange={(value) => updateSuggestionDisplay("npcs", value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="suggestions-sprites">Sprites</Label>
                    <Switch
                      id="suggestions-sprites"
                      checked={settings.suggestionDisplay.sprites}
                      onCheckedChange={(value) => updateSuggestionDisplay("sprites", value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="suggestions-sequences">Sequences</Label>
                    <Switch
                      id="suggestions-sequences"
                      checked={settings.suggestionDisplay.sequences}
                      onCheckedChange={(value) => updateSuggestionDisplay("sequences", value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="suggestions-spotanims">Spot Animations</Label>
                    <Switch
                      id="suggestions-spotanims"
                      checked={settings.suggestionDisplay.spotanims}
                      onCheckedChange={(value) => updateSuggestionDisplay("spotanims", value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="suggestions-textures">Textures</Label>
                    <Switch
                      id="suggestions-textures"
                      checked={settings.suggestionDisplay.textures}
                      onCheckedChange={(value) => updateSuggestionDisplay("textures", value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="suggestions-underlays-overlays">Underlays/Overlays</Label>
                    <Switch
                      id="suggestions-underlays-overlays"
                      checked={settings.suggestionDisplay.underlaysOverlays}
                      onCheckedChange={(value) =>
                        updateSuggestionDisplay("underlaysOverlays", value)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="themes" className="space-y-6 mt-4">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold mb-3 block">Default Themes</Label>
                <div className="space-y-2">
                  {DEFAULT_THEMES.map((theme) => (
                    <Button
                      key={theme.value}
                      variant={settings.themePreset === theme.value ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => updateSettings({ themePreset: theme.value })}
                    >
                      <span className="flex-1 text-left">{theme.name}</span>
                      {settings.themePreset === theme.value && <Check className="h-4 w-4" />}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Scaled Themes</Label>
                <div className="space-y-2">
                  {SCALED_THEMES.map((theme) => (
                    <Button
                      key={theme.value}
                      variant={settings.themePreset === theme.value ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => updateSettings({ themePreset: theme.value })}
                    >
                      <span className="flex-1 text-left">{theme.name}</span>
                      {settings.themePreset === theme.value && <Check className="h-4 w-4" />}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Mono Themes</Label>
                <div className="space-y-2">
                  {MONO_THEMES.map((theme) => (
                    <Button
                      key={theme.value}
                      variant={settings.themePreset === theme.value ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => updateSettings({ themePreset: theme.value })}
                    >
                      <span className="flex-1 text-left">{theme.name}</span>
                      {settings.themePreset === theme.value && <Check className="h-4 w-4" />}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
