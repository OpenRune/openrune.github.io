"use client";

import * as React from "react";
import { Upload, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBinarySize } from "@/lib/formatting";
import type { UploadedPerformanceFile } from "@/lib/types/performance";

type UploadMode = "single" | "compare";

type UploadModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: UploadMode;
  onModeChange: (mode: UploadMode) => void;
  files: UploadedPerformanceFile[];
  isProcessing: boolean;
  onUploadSingle: (file: File | null, index: number) => Promise<void>;
  onUploadBatch: (files: FileList | null, maxFiles: number) => Promise<void>;
  onRemove: (index: number) => void;
  onConfirm: () => void;
};

export function UploadModal({
  open,
  onOpenChange,
  mode,
  onModeChange,
  files,
  isProcessing,
  onUploadSingle,
  onUploadBatch,
  onRemove,
  onConfirm,
}: UploadModalProps) {
  const singleInputRef = React.useRef<HTMLInputElement | null>(null);
  const compareFirstRef = React.useRef<HTMLInputElement | null>(null);
  const compareSecondRef = React.useRef<HTMLInputElement | null>(null);

  const maxFiles = mode === "single" ? 1 : 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload 117 Performance Snapshots</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(value) => onModeChange(value as UploadMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single File</TabsTrigger>
            <TabsTrigger value="compare">Compare Files</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4">
            <div className="rounded-lg border-2 border-dashed p-6 text-center">
              <input
                ref={singleInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(event) => void onUploadBatch(event.target.files, 1)}
              />
              <Button
                variant="outline"
                onClick={() => singleInputRef.current?.click()}
                disabled={Boolean(files[0])}
              >
                <Upload className="mr-2 size-4" />
                Select JSON File
              </Button>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload one 117 performance snapshot file.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="compare" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border-2 border-dashed p-4 text-center">
                <input
                  ref={compareFirstRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(event) => void onUploadSingle(event.target.files?.[0] ?? null, 0)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => compareFirstRef.current?.click()}
                  disabled={Boolean(files[0])}
                >
                  <Upload className="mr-2 size-4" />
                  First File
                </Button>
              </div>
              <div className="rounded-lg border-2 border-dashed p-4 text-center">
                <input
                  ref={compareSecondRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(event) => void onUploadSingle(event.target.files?.[0] ?? null, 1)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => compareSecondRef.current?.click()}
                  disabled={Boolean(files[1])}
                >
                  <Upload className="mr-2 size-4" />
                  Second File
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {files.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected files</p>
            {files.map((file, index) => (
              <div key={file.id} className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <Badge variant="secondary">{formatBinarySize(file.size)}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing || files.length === 0 || files.length > maxFiles}
          >
            {isProcessing ? "Processing..." : "Analyze"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
