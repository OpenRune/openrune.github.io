"use client";

import * as React from "react";
import { IconDownload } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { LazyWhenVisible } from "@/components/ui/lazy-when-visible";
import { RsColorBox } from "@/components/ui/rs-color-box";
import { RSTexture } from "@/components/ui/RSTexture";
import { useCacheType } from "@/context/cache-type-context";
import { SPRITETYPES, useGamevals } from "@/context/gameval-context";
import { useSettings } from "@/context/settings-context";
import { cacheTexturesSnapshotUrl, diffSpriteImageUrl } from "@/lib/cache-api-client";
import { downloadUrlAsFile } from "@/lib/download-url";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";
import { cn } from "@/lib/utils";

import { parsePackedHslValue } from "./diff-archive-table-utils";
import { GAMEVAL_MIN_REVISION } from "./diff-constants";
import type { InspectorChangeKind } from "./diff-inspector-panel";
import type { DiffMode } from "./diff-types";

const FIELD_ORDER = [
  "averageRgb",
  "fileId",
  "lowDetail",
  "lowMem",
  "isTransparent",
  "transparent",
  "animationDirection",
  "animationSpeed",
] as const;

function formatFieldLabel(key: string): string {
  const known: Record<string, string> = {
    averageRgb: "Average RGB",
    fileId: "File ID",
    lowDetail: "Low detail",
    lowMem: "Low mem",
    isTransparent: "Transparent",
    transparent: "Transparent",
    animationDirection: "Animation direction",
    animationSpeed: "Animation speed",
  };
  if (known[key]) return known[key];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function isBoolField(key: string): boolean {
  return key === "lowDetail" || key === "lowMem" || key === "transparent" || key === "isTransparent";
}

function formatBoolish(value: string): string {
  const s = String(value).toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return "true";
  if (s === "false" || s === "0" || s === "no") return "false";
  return String(value);
}

function coerceFileId(entries: Record<string, string>): number | null {
  const raw = entries.fileId;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function orderedFieldEntries(entries: Record<string, string>): Array<[string, string]> {
  const seen = new Set<string>();
  const out: Array<[string, string]> = [];
  for (const key of FIELD_ORDER) {
    const v = entries[key];
    if (v == null || v === "") continue;
    seen.add(key);
    out.push([key, v]);
  }
  for (const [key, v] of Object.entries(entries)) {
    if (seen.has(key) || v == null || v === "") continue;
    out.push([key, v]);
  }
  return out;
}

export type DiffTextureViewerProps = {
  textureDefinitionId: number;
  kind: InspectorChangeKind;
  entries: Record<string, string>;
  /** Sprite file id for image + gameval (textures have no own gamevals). */
  fileId?: number | null;
  diffViewMode: DiffMode;
  combinedRev: number;
  baseRev: number;
  rev: number;
  className?: string;
};

export function DiffTextureViewer({
  textureDefinitionId,
  kind,
  entries: entriesProp,
  fileId: fileIdProp,
  diffViewMode,
  combinedRev,
  baseRev,
  rev,
  className,
}: DiffTextureViewerProps) {
  const { settings } = useSettings();
  const { selectedCacheType } = useCacheType();
  const { lookupGameval, getGamevalExtra, loadGamevalType } = useGamevals();
  const [loadedEntries, setLoadedEntries] = React.useState<Record<string, string> | null>(null);

  const listRev = diffViewMode === "combined" ? combinedRev : kind === "removed" ? Math.min(baseRev, rev) : Math.max(baseRev, rev);

  React.useEffect(() => {
    if (Object.keys(entriesProp).length > 0) {
      setLoadedEntries(null);
      return;
    }
    const ac = new AbortController();
    void (async () => {
      try {
        const { data } = await conditionalJsonFetch<Record<string, unknown>>(
          `cache:textures:snapshot:${selectedCacheType.id}:${listRev}:one:${textureDefinitionId}`,
          cacheTexturesSnapshotUrl(selectedCacheType, listRev),
          { signal: ac.signal },
        );
        const snapshots =
          data?.snapshots && typeof data.snapshots === "object" && !Array.isArray(data.snapshots)
            ? (data.snapshots as Record<string, unknown>)
            : null;
        const snap = snapshots?.[String(textureDefinitionId)];
        if (!snap || typeof snap !== "object" || Array.isArray(snap)) {
          setLoadedEntries({});
          return;
        }
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(snap as Record<string, unknown>)) {
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = String(v);
        }
        setLoadedEntries(out);
      } catch {
        if (!ac.signal.aborted) setLoadedEntries({});
      }
    })();
    return () => ac.abort();
  }, [entriesProp, listRev, selectedCacheType, textureDefinitionId]);

  const entries = Object.keys(entriesProp).length > 0 ? entriesProp : (loadedEntries ?? {});
  const fileId = fileIdProp ?? coerceFileId(entries);
  const gamevalRev = diffViewMode === "combined" ? combinedRev : Math.max(baseRev, rev);
  const gamevalSupported = gamevalRev >= GAMEVAL_MIN_REVISION;

  React.useEffect(() => {
    if (!gamevalSupported || fileId == null) return;
    void loadGamevalType(SPRITETYPES, gamevalRev);
  }, [fileId, gamevalRev, gamevalSupported, loadGamevalType]);

  const gamevalName = React.useMemo(() => {
    if (!gamevalSupported || fileId == null) return null;
    return (
      lookupGameval(SPRITETYPES, fileId, gamevalRev)?.trim() ||
      getGamevalExtra(SPRITETYPES, fileId, gamevalRev)?.searchable?.trim() ||
      null
    );
  }, [fileId, gamevalRev, gamevalSupported, getGamevalExtra, lookupGameval]);

  const fields = React.useMemo(() => orderedFieldEntries(entries), [entries]);
  const imageRev = diffViewMode === "combined" ? combinedRev : kind === "removed" ? Math.min(baseRev, rev) : Math.max(baseRev, rev);

  const imageUrl = React.useMemo(() => {
    if (fileId == null) return null;
    return diffSpriteImageUrl(selectedCacheType, fileId, {
      base: 1,
      rev: imageRev,
      source: imageRev,
    });
  }, [fileId, imageRev, selectedCacheType]);

  const [downloading, setDownloading] = React.useState(false);

  const downloadImage = React.useCallback(async () => {
    if (!imageUrl || fileId == null) return;
    setDownloading(true);
    try {
      await downloadUrlAsFile(imageUrl, `texture-${textureDefinitionId}-file-${fileId}-rev${imageRev}.png`);
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }, [fileId, imageRev, imageUrl, textureDefinitionId]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row", className)}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Texture</div>
            <div className="font-mono text-sm text-foreground">
              id={textureDefinitionId}
              {fileId != null ? <span className="text-muted-foreground"> · fileId={fileId}</span> : null}
            </div>
          </div>
          {gamevalName ? (
            <button
              type="button"
              className="max-w-full truncate text-left font-mono text-xs text-sky-400 hover:underline"
              title="Copy gameval (from sprite fileId)"
              onClick={() => {
                const text = settings.copyGamevalsToUppercase ? gamevalName.toUpperCase() : gamevalName;
                void navigator.clipboard.writeText(text);
              }}
            >
              {gamevalName}
            </button>
          ) : null}
        </div>

        <div className="relative flex min-h-[12rem] flex-1 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-black/40">
          {fileId != null ? (
            <LazyWhenVisible
              className="relative size-full min-h-[12rem]"
              fallback={<div className="absolute inset-0 bg-muted/30" aria-hidden />}
            >
              <RSTexture
                id={fileId}
                textureDefinitionId={textureDefinitionId}
                combinedDiffSprite
                gameval={gamevalName ?? undefined}
                gamevalRevision={gamevalRev}
                rev={imageRev}
                base={1}
                width={256}
                height={256}
                fitMax
                fillCell
                keepAspectRatio
                rounded={false}
                className="absolute inset-0 size-full"
              />
            </LazyWhenVisible>
          ) : (
            <p className="px-4 text-center text-sm text-muted-foreground">No fileId on this texture.</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            {kind === "added" ? "Added" : kind === "removed" ? "Removed" : "Changed"}
            {diffViewMode === "diff" ? ` · base ${baseRev} → compare ${rev}` : ` · rev ${combinedRev}`}
          </p>
          {imageUrl ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloading}
              onClick={() => void downloadImage()}
            >
              <IconDownload className="size-3.5" />
              {downloading ? "Downloading…" : "Download"}
            </Button>
          ) : null}
        </div>
      </div>

      <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-lg border bg-card lg:w-[22rem]">
        <div className="shrink-0 border-b px-4 py-2.5">
          <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Config fields
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
            {fields.length === 0
              ? "No fields on this texture"
              : `${fields.length} field${fields.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {fields.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No fields available.</p>
          ) : (
            <dl className="divide-y divide-border/60">
              {fields.map(([key, value]) => {
                const isRgb = key === "averageRgb";
                const packed = isRgb ? parsePackedHslValue(value) : null;
                const boolish = isBoolField(key);
                const boolValue = boolish ? formatBoolish(value) : null;
                const isTrue = boolValue === "true";
                const isFalse = boolValue === "false";

                return (
                  <div
                    key={key}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-0.5 px-4 py-3 hover:bg-muted/35"
                  >
                    <dt className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-foreground">
                        {formatFieldLabel(key)}
                      </div>
                      <div className="truncate font-mono text-[10px] text-muted-foreground">{key}</div>
                    </dt>
                    <dd className="flex max-w-[11rem] items-center justify-end gap-2">
                      {isRgb && packed != null ? (
                        <span className="inline-flex items-center gap-2 rounded-md border border-border/70 bg-muted/40 px-2 py-1">
                          <RsColorBox packedHsl={packed} className="size-4 shrink-0 rounded-[3px]" />
                          <span className="font-mono text-[12px] tabular-nums text-foreground">{value}</span>
                        </span>
                      ) : boolish && (isTrue || isFalse) ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
                            isTrue
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {isTrue ? "true" : "false"}
                        </span>
                      ) : (
                        <span className="truncate font-mono text-[12px] tabular-nums text-foreground">
                          {value}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      </aside>
    </div>
  );
}
