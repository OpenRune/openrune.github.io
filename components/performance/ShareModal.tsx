'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';

interface ShareModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  onCopyLink: () => void;
}

export default function ShareModal({
  isOpen,
  onOpenChange,
  shareUrl,
  onCopyLink
}: ShareModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Performance Analysis</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg inline-block">
              <QRCodeSVG value={shareUrl} size={200} />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              Scan the QR code or copy the link below to share your performance analysis.
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Link expires in 4 hours
            </p>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 bg-transparent text-sm outline-none"
            />
            <Button
              onClick={onCopyLink}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              Copy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 