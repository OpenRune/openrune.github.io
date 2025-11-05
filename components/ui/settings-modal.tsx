'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconSettings, IconSun, IconMoon } from '@tabler/icons-react';
import { useTheme } from 'next-themes';
import { useThemeConfig } from '@/components/active-theme';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  copyGamevalsToUppercase: boolean;
  onCopyGamevalsToUppercaseChange: (value: boolean) => void;
  fullWidthContent: boolean;
  onFullWidthContentChange: (value: boolean) => void;
  allowMultipleCollapsiblesOpen: boolean;
  onAllowMultipleCollapsiblesOpenChange: (value: boolean) => void;
  navItemSize: 'small' | 'medium' | 'large';
  onNavItemSizeChange: (value: 'small' | 'medium' | 'large') => void;
}

const DEFAULT_THEMES = [
  { name: 'Default', value: 'default' },
  { name: 'Blue', value: 'blue' },
  { name: 'Green', value: 'green' },
  { name: 'Amber', value: 'amber' }
];

const SCALED_THEMES = [
  { name: 'Default', value: 'default-scaled' },
  { name: 'Blue', value: 'blue-scaled' }
];

const MONO_THEMES = [
  { name: 'Mono', value: 'mono-scaled' }
];

export default function SettingsModal({
  isOpen,
  onOpenChange,
  copyGamevalsToUppercase,
  onCopyGamevalsToUppercaseChange,
  fullWidthContent,
  onFullWidthContentChange,
  allowMultipleCollapsiblesOpen,
  onAllowMultipleCollapsiblesOpenChange,
  navItemSize,
  onNavItemSizeChange
}: SettingsModalProps) {
  const { setTheme, resolvedTheme } = useTheme();
  const { activeTheme, setActiveTheme } = useThemeConfig();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeToggle = React.useCallback(() => {
    const newMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;

    if (!document.startViewTransition) {
      setTheme(newMode);
      return;
    }

    document.startViewTransition(() => {
      setTheme(newMode);
    });
  }, [resolvedTheme, setTheme]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconSettings size={20} />
            Settings
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="themes">Themes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="dark-light-mode">Dark / Light Mode</Label>
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
                >
                  {resolvedTheme === 'dark' ? (
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
                  When enabled, any selected text that appears to be a gameval will be automatically converted to uppercase when copied
                </p>
              </div>
              <Switch
                id="copy-gamevals-uppercase"
                checked={copyGamevalsToUppercase}
                onCheckedChange={onCopyGamevalsToUppercaseChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="full-width-content">Full width content</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, page content will use the full available width instead of being constrained to a maximum width
                </p>
              </div>
              <Switch
                id="full-width-content"
                checked={fullWidthContent}
                onCheckedChange={onFullWidthContentChange}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="allow-multiple-collapsibles">Allow multiple sidebar sections open</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, you can have multiple sidebar navigation sections open at the same time. When disabled, opening one section will close others.
                </p>
              </div>
              <Switch
                id="allow-multiple-collapsibles"
                checked={allowMultipleCollapsiblesOpen}
                onCheckedChange={onAllowMultipleCollapsiblesOpenChange}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="nav-item-size">Navigation item size</Label>
                <p className="text-sm text-muted-foreground">
                  Control the size of sidebar navigation items
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={navItemSize === 'small' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onNavItemSizeChange('small')}
                >
                  Small
                </Button>
                <Button
                  variant={navItemSize === 'medium' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onNavItemSizeChange('medium')}
                >
                  Medium
                </Button>
                <Button
                  variant={navItemSize === 'large' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onNavItemSizeChange('large')}
                >
                  Large
                </Button>
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
                      variant={activeTheme === theme.value ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setActiveTheme(theme.value)}
                    >
                      <span className="flex-1 text-left">{theme.name}</span>
                      {activeTheme === theme.value && (
                        <Check className="h-4 w-4" />
                      )}
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
                      variant={activeTheme === theme.value ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setActiveTheme(theme.value)}
                    >
                      <span className="flex-1 text-left">{theme.name}</span>
                      {activeTheme === theme.value && (
                        <Check className="h-4 w-4" />
                      )}
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
                      variant={activeTheme === theme.value ? "default" : "outline"}
                      className="w-full justify-start"
                      onClick={() => setActiveTheme(theme.value)}
                    >
                      <span className="flex-1 text-left">{theme.name}</span>
                      {activeTheme === theme.value && (
                        <Check className="h-4 w-4" />
                      )}
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