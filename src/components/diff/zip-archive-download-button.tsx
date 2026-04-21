"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useZipDownload } from "@/context/zip-download-context";
import type { ZipArchiveKind } from "@/lib/zip-download";
import type { DiffMode } from "./diff-types";

type Props = {
  kind: ZipArchiveKind;
  diffViewMode: DiffMode;
  combinedRev: number;
  baseRev: number;
  rev: number;
  tableBase?: number;
};

export function ZipArchiveDownloadButton({
  kind,
  diffViewMode,
  combinedRev,
  baseRev,
  rev,
  tableBase = 1,
}: Props) {
  const { startZipExport } = useZipDownload();

  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      className="!h-9 shrink-0 gap-1.5 px-3 text-sm"
      onClick={() =>
        startZipExport({
          kind,
          diffViewMode,
          combinedRev,
          baseRev,
          rev,
          tableBase,
        })
      }
    >
      <Download className="size-3.5" aria-hidden />
      {kind === "sprites" ? "Download Sprites" : "Download Textures"}
    </Button>
  );
}
