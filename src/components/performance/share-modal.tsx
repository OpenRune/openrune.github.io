"use client";

import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ShareModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  onCopy: () => Promise<void> | void;
};

export function ShareModal({ open, onOpenChange, url, onCopy }: ShareModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Performance Analysis</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            <div className="inline-block rounded-lg bg-white p-3">
              <QRCodeSVG value={url} size={180} />
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Share links expire in 4 hours.
          </p>
          <div className="flex gap-2">
            <Input value={url} readOnly />
            <Button variant="outline" onClick={() => void onCopy()}>
              <Copy className="mr-1 size-4" />
              Copy
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
