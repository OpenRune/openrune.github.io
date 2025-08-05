'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { IconSettings } from '@tabler/icons-react';

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  copyGamevalsToUppercase: boolean;
  onCopyGamevalsToUppercaseChange: (value: boolean) => void;
}

export default function SettingsModal({
  isOpen,
  onOpenChange,
  copyGamevalsToUppercase,
  onCopyGamevalsToUppercaseChange
}: SettingsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconSettings size={20} />
            Settings
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
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
        </div>
      </DialogContent>
    </Dialog>
  );
} 