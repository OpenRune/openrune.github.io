"use client";

import * as React from "react";
import { ChevronDown, FileJson2, Upload, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBinarySize } from "@/lib/formatting";
import type { UploadedPerformanceFile } from "@/lib/types/performance";

type FileDropdownProps = {
  open: boolean;
  onToggle: () => void;
  files: UploadedPerformanceFile[];
  mode: "single" | "compare";
  onModeChange: (mode: "single" | "compare") => void;
  onUploadSingle: (file: File | null, index: number) => Promise<void>;
  onRemove: (index: number) => void;
  inputRef1: React.RefObject<HTMLInputElement | null>;
  inputRef2: React.RefObject<HTMLInputElement | null>;
};

export function FileDropdown({
  open,
  onToggle,
  files,
  mode,
  onModeChange,
  onUploadSingle,
  onRemove,
  inputRef1,
  inputRef2,
}: FileDropdownProps) {
  return (
    <div className="relative file-dropdown">
      <Button variant="outline" className="flex items-center gap-2" onClick={onToggle}>
        <FileJson2 className="size-4" />
        Files
        <ChevronDown className="size-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 w-96 rounded-lg border bg-popover shadow-lg">
          <div className="space-y-4 p-4">
            <div className="text-sm font-semibold">Uploaded Files</div>

            <Tabs value={mode} onValueChange={(value) => onModeChange(value as "single" | "compare")} className="w-full">
              <TabsList className="grid h-8 w-full grid-cols-2">
                <TabsTrigger value="single" className="text-xs">Single</TabsTrigger>
                <TabsTrigger value="compare" className="text-xs">Compare</TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="mt-3 space-y-3">
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-3 text-center">
                  <input
                    ref={inputRef1}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(event) => void onUploadSingle(event.target.files?.[0] ?? null, 0)}
                  />
                  <Button
                    onClick={() => inputRef1.current?.click()}
                    variant="outline"
                    size="sm"
                    className="mx-auto flex items-center gap-1 text-xs"
                    disabled={files[0] !== undefined}
                  >
                    <Upload className="size-3" />
                    Select File
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">Single file analysis</p>
                  {files[0] ? (
                    <div className="mt-2 rounded bg-muted p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{files[0].name}</span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => onRemove(0)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                      <Badge variant="secondary" className="mt-1 text-xs">{formatBinarySize(files[0].size)}</Badge>
                    </div>
                  ) : null}
                </div>
              </TabsContent>

              <TabsContent value="compare" className="mt-3 space-y-3">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border-2 border-dashed border-gray-300 p-3 text-center">
                    <input
                      ref={inputRef1}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(event) => void onUploadSingle(event.target.files?.[0] ?? null, 0)}
                    />
                    <Button
                      onClick={() => inputRef1.current?.click()}
                      variant="outline"
                      size="sm"
                      className="mx-auto flex items-center gap-1 text-xs"
                      disabled={files[0] !== undefined}
                    >
                      <Upload className="size-3" />
                      First File
                    </Button>
                    {files[0] ? (
                      <div className="mt-2 rounded bg-muted p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{files[0].name}</span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => onRemove(0)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                        <Badge variant="secondary" className="mt-1 text-xs">{formatBinarySize(files[0].size)}</Badge>
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-lg border-2 border-dashed border-gray-300 p-3 text-center">
                    <input
                      ref={inputRef2}
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(event) => void onUploadSingle(event.target.files?.[0] ?? null, 1)}
                    />
                    <Button
                      onClick={() => inputRef2.current?.click()}
                      variant="outline"
                      size="sm"
                      className="mx-auto flex items-center gap-1 text-xs"
                      disabled={files[1] !== undefined}
                    >
                      <Upload className="size-3" />
                      Second File
                    </Button>
                    {files[1] ? (
                      <div className="mt-2 rounded bg-muted p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{files[1].name}</span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => onRemove(1)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                        <Badge variant="secondary" className="mt-1 text-xs">{formatBinarySize(files[1].size)}</Badge>
                      </div>
                    ) : null}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      ) : null}
    </div>
  );
}
