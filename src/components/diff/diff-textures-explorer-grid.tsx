"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LazyWhenVisible } from "@/components/ui/lazy-when-visible";
import { RSTexture } from "@/components/ui/RSTexture";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePaginationBar } from "@/components/ui/table-pagination-bar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCacheType } from "@/context/cache-type-context";
import { SPRITETYPES, useGamevals } from "@/context/gameval-context";
import { useSettings } from "@/context/settings-context";
import {
  cacheTexturesSnapshotUrl,
  diffCacheOrderedPair,
  diffConfigContentUrl,
} from "@/lib/cache-api-client";
import { conditionalJsonFetchAwaitingDecode } from "@/lib/diff-decode";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import { GAMEVAL_MIN_REVISION, TEXTURE_PER_PAGE_OPTIONS } from "./diff-constants";
import { DiffSectionHeader } from "./diff-section-header";
import { DiffTextureViewer } from "./diff-texture-viewer";
import { idQueryMatchesNumericId } from "./diff-id-search";
import type { InspectorChangeKind } from "./diff-inspector-panel";
import { diffSearchModeTooltipHelp } from "./diff-search-modes";
import {
  matchesSpriteGamevalTags,
  spriteMatchesRegex,
  spriteMatchesSubstringName,
} from "./diff-sprite-gameval-filter";
import type { ConfigFilterMode, DiffMode, DiffSearchFieldMode, SearchTag } from "./diff-types";

const PAGE_DEBOUNCE_MS = 120;

export type TextureGridEntry = {
  id: number;
  kind: InspectorChangeKind;
  fileId: number | null;
  entries: Record<string, string>;
};

function snapToStringEntries(snap: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(snap)) {
    if (v == null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = String(v);
    }
  }
  return out;
}

function fileIdFromUnknown(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    const row = value as { to?: unknown; from?: unknown; value?: unknown };
    return fileIdFromUnknown(row.to) ?? fileIdFromUnknown(row.from) ?? fileIdFromUnknown(row.value);
  }
  return null;
}

function entriesFromContentValue(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const row = v as { to?: unknown; from?: unknown; value?: unknown };
      const pick = row.to ?? row.value ?? row.from;
      if (pick != null && (typeof pick === "string" || typeof pick === "number" || typeof pick === "boolean")) {
        out[k] = String(pick);
      }
      continue;
    }
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = String(v);
    }
  }
  return out;
}

function parseSnapshotMap(data: Record<string, unknown> | null | undefined): Map<number, Record<string, string>> {
  const out = new Map<number, Record<string, string>>();
  if (!data) return out;
  const snapshots =
    data.snapshots && typeof data.snapshots === "object" && !Array.isArray(data.snapshots)
      ? (data.snapshots as Record<string, unknown>)
      : null;
  if (!snapshots) return out;
  for (const [idRaw, snap] of Object.entries(snapshots)) {
    const id = Number(idRaw);
    if (!Number.isFinite(id) || !snap || typeof snap !== "object" || Array.isArray(snap)) continue;
    out.set(Math.trunc(id), snapToStringEntries(snap as Record<string, unknown>));
  }
  return out;
}

type DiffTexturesExplorerGridProps = {
  diffViewMode: DiffMode;
  combinedRev: number;
  baseRev: number;
  rev: number;
  controlledSearch?: {
    mode: DiffSearchFieldMode;
    text: string;
    tags: SearchTag[];
    deltaFilterMode?: ConfigFilterMode;
  } | null;
  /** When set, open explorer-hosted dialog instead of local modal. */
  onOpenTexture?: (entry: TextureGridEntry) => void;
  selectedId?: number | null;
};

export function DiffTexturesExplorerGrid({
  diffViewMode,
  combinedRev,
  baseRev,
  rev,
  controlledSearch = null,
  onOpenTexture,
  selectedId = null,
}: DiffTexturesExplorerGridProps) {
  const { selectedCacheType } = useCacheType();
  const { settings } = useSettings();
  const { loadGamevalType, hasLoaded, lookupGameval, getGamevalExtra } = useGamevals();

  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(105);
  const debouncedPage = useDebouncedValue(page, PAGE_DEBOUNCE_MS);
  const [entries, setEntries] = React.useState<TextureGridEntry[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [localModal, setLocalModal] = React.useState<TextureGridEntry | null>(null);
  const fetchSeq = React.useRef(0);

  const gamevalRev = diffViewMode === "combined" ? combinedRev : Math.max(baseRev, rev);
  const gamevalSupported = gamevalRev >= GAMEVAL_MIN_REVISION;
  const searchMode = controlledSearch?.mode ?? "id";
  const searchText = controlledSearch?.text ?? "";
  const searchTags = controlledSearch?.tags ?? [];
  const kindFilter = controlledSearch?.deltaFilterMode ?? "all";

  React.useEffect(() => {
    const seq = ++fetchSeq.current;
    const ac = new AbortController();
    setStatus("loading");

    void (async () => {
      try {
        const listRev = diffViewMode === "combined" ? combinedRev : Math.max(baseRev, rev);
        const showDeltas = diffViewMode === "diff" && baseRev !== rev;

        if (showDeltas) {
          const params = diffCacheOrderedPair(baseRev, rev);
          const key = `diff:config:content:${selectedCacheType.id}:textures:${params.base}:${params.rev}`;
          const { data } = await conditionalJsonFetchAwaitingDecode<{
            added?: Record<string, unknown>;
            changed?: Record<string, unknown>;
            removed?: unknown;
          }>(key, diffConfigContentUrl(selectedCacheType, "textures", params), {
            cacheType: selectedCacheType,
            signal: ac.signal,
          });
          if (seq !== fetchSeq.current) return;

          const [newerSnap, olderSnap] = await Promise.all([
            conditionalJsonFetch<Record<string, unknown>>(
              `cache:textures:snapshot:${selectedCacheType.id}:${params.rev}`,
              cacheTexturesSnapshotUrl(selectedCacheType, params.rev),
              { signal: ac.signal },
            ).catch(() => ({ data: null as Record<string, unknown> | null })),
            conditionalJsonFetch<Record<string, unknown>>(
              `cache:textures:snapshot:${selectedCacheType.id}:${params.base}`,
              cacheTexturesSnapshotUrl(selectedCacheType, params.base),
              { signal: ac.signal },
            ).catch(() => ({ data: null as Record<string, unknown> | null })),
          ]);
          if (seq !== fetchSeq.current) return;

          const newerMap = parseSnapshotMap(newerSnap.data);
          const olderMap = parseSnapshotMap(olderSnap.data);
          const next: TextureGridEntry[] = [];

          for (const [idRaw, value] of Object.entries(data?.added ?? {})) {
            const id = Number(idRaw);
            if (!Number.isFinite(id)) continue;
            const fromContent = entriesFromContentValue(value);
            const fromSnap = newerMap.get(Math.trunc(id)) ?? {};
            const entries = { ...fromSnap, ...fromContent };
            next.push({
              id: Math.trunc(id),
              kind: "added",
              fileId: fileIdFromUnknown(entries.fileId) ?? fileIdFromUnknown((value as { fileId?: unknown })?.fileId),
              entries,
            });
          }
          for (const [idRaw, value] of Object.entries(data?.changed ?? {})) {
            const id = Number(idRaw);
            if (!Number.isFinite(id)) continue;
            const fromContent = entriesFromContentValue(value);
            const fromSnap = newerMap.get(Math.trunc(id)) ?? {};
            const entries = { ...fromSnap, ...fromContent };
            next.push({
              id: Math.trunc(id),
              kind: "changed",
              fileId: fileIdFromUnknown(entries.fileId),
              entries,
            });
          }
          const removed = Array.isArray(data?.removed) ? data.removed : [];
          for (const idRaw of removed) {
            const id = typeof idRaw === "number" ? idRaw : Number(idRaw);
            if (!Number.isFinite(id)) continue;
            const fromSnap = olderMap.get(Math.trunc(id)) ?? newerMap.get(Math.trunc(id)) ?? {};
            next.push({
              id: Math.trunc(id),
              kind: "removed",
              fileId: fileIdFromUnknown(fromSnap.fileId),
              entries: fromSnap,
            });
          }
          setEntries(next.sort((a, b) => a.id - b.id));
          setStatus("ok");
          return;
        }

        const { data } = await conditionalJsonFetch<Record<string, unknown>>(
          `cache:textures:snapshot:${selectedCacheType.id}:${listRev}`,
          cacheTexturesSnapshotUrl(selectedCacheType, listRev),
          { signal: ac.signal },
        );
        if (seq !== fetchSeq.current) return;
        const map = parseSnapshotMap(data);
        const next: TextureGridEntry[] = [...map.entries()]
          .map(([id, entries]) => ({
            id,
            kind: "changed" as const,
            fileId: fileIdFromUnknown(entries.fileId),
            entries,
          }))
          .sort((a, b) => a.id - b.id);
        setEntries(next);
        setStatus("ok");
      } catch {
        if (ac.signal.aborted || seq !== fetchSeq.current) return;
        setEntries([]);
        setStatus("error");
      }
    })();

    return () => ac.abort();
  }, [baseRev, combinedRev, diffViewMode, rev, selectedCacheType]);

  React.useEffect(() => {
    if (!gamevalSupported) return;
    const needs =
      (searchMode === "gameval" && searchTags.length > 0) ||
      searchMode === "name" ||
      (searchMode === "regex" && searchText.trim().length > 0);
    if (!needs) return;
    void loadGamevalType(SPRITETYPES, gamevalRev);
  }, [gamevalRev, gamevalSupported, loadGamevalType, searchMode, searchTags.length, searchText]);

  const gvFns = React.useMemo(
    () => ({ lookupGameval, getGamevalExtra }),
    [getGamevalExtra, lookupGameval],
  );

  const filtered = React.useMemo(() => {
    const q = searchText.trim();
    const gvReady = gamevalSupported && hasLoaded(SPRITETYPES, gamevalRev);
    return entries.filter((entry) => {
      if (diffViewMode === "diff" && kindFilter !== "all" && entry.kind !== kindFilter) return false;
      const filterId = entry.fileId ?? entry.id;
      if (searchMode === "id") return !q || idQueryMatchesNumericId(entry.id, q) || idQueryMatchesNumericId(filterId, q);
      if (searchMode === "gameval") {
        if (searchTags.length === 0) return true;
        if (!gvReady || entry.fileId == null) return false;
        return matchesSpriteGamevalTags(SPRITETYPES, entry.fileId, searchTags, gamevalRev, gvFns);
      }
      if (searchMode === "name") {
        if (!q) return true;
        if (!gvReady || entry.fileId == null) return false;
        return spriteMatchesSubstringName(SPRITETYPES, entry.fileId, q, gamevalRev, gvFns);
      }
      if (searchMode === "regex") {
        if (!q) return true;
        if (!gvReady || entry.fileId == null) return false;
        return spriteMatchesRegex(SPRITETYPES, entry.fileId, q, gamevalRev, gvFns);
      }
      return true;
    });
  }, [
    diffViewMode,
    entries,
    gamevalRev,
    gamevalSupported,
    gvFns,
    hasLoaded,
    kindFilter,
    searchMode,
    searchTags,
    searchText,
  ]);

  React.useEffect(() => {
    setPage(1);
  }, [searchMode, searchText, searchTags, kindFilter, diffViewMode, baseRev, rev, combinedRev]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const dataPage = Math.min(Math.max(1, debouncedPage), totalPages);
  const paged = React.useMemo(() => {
    const start = (dataPage - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [dataPage, filtered, perPage]);

  const openEntry = React.useCallback(
    (entry: TextureGridEntry) => {
      if (onOpenTexture) {
        onOpenTexture(entry);
        return;
      }
      setLocalModal(entry);
    },
    [onOpenTexture],
  );

  const imageRev = diffViewMode === "combined" ? combinedRev : Math.max(baseRev, rev);

  return (
    <>
      <DiffSectionHeader
        title={diffViewMode === "combined" ? "Textures" : `Texture changes (Base ${baseRev} → Compare ${rev})`}
        tooltipContent={diffSearchModeTooltipHelp(searchMode)}
        countLabel={`· ${filtered.length.toLocaleString()} texture${filtered.length !== 1 ? "s" : ""}`}
      />

      {status === "loading" ? (
        <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(80px,1fr))] content-start gap-2 overflow-auto">
          {Array.from({ length: 24 }, (_, i) => (
            <Skeleton key={i} className="min-h-[5.5rem] w-full rounded" delayMs={(i % 8) * 30} />
          ))}
        </div>
      ) : status === "error" ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Failed to load textures.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No textures match the current filters.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(80px,1fr))] content-start gap-2 overflow-auto">
            {paged.map((entry) => {
              const active = selectedId === entry.id;
              const gv =
                entry.fileId != null && gamevalSupported && settings.suggestionDisplay.textures
                  ? lookupGameval(SPRITETYPES, entry.fileId, gamevalRev) ||
                    getGamevalExtra(SPRITETYPES, entry.fileId, gamevalRev)?.searchable
                  : null;
              return (
                <Tooltip key={`${entry.kind}-${entry.id}`}>
                  <TooltipTrigger>
                    <div
                      role="button"
                      tabIndex={0}
                      data-repo-entry-active={active ? "true" : undefined}
                      className={cn(
                        "relative flex min-h-[5.5rem] w-full cursor-pointer flex-col overflow-hidden rounded border border-border bg-muted/30 p-1 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active && "ring-2 ring-ring",
                        entry.kind === "added" && "border-green-600/50",
                        entry.kind === "changed" && diffViewMode === "diff" && "border-amber-600/50",
                        entry.kind === "removed" && "border-red-600/50",
                      )}
                      onClick={() => openEntry(entry)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openEntry(entry);
                        }
                      }}
                    >
                      <LazyWhenVisible
                        className="relative min-h-[4rem] w-full flex-1 rounded-sm"
                        fallback={<div className="absolute inset-0 rounded-sm bg-muted/35" aria-hidden />}
                      >
                        {entry.fileId != null ? (
                          <RSTexture
                            id={entry.fileId}
                            textureDefinitionId={entry.id}
                            combinedDiffSprite
                            gameval={gv?.trim() || undefined}
                            gamevalRevision={gamevalRev}
                            rev={entry.kind === "removed" ? Math.min(baseRev, rev) : imageRev}
                            base={1}
                            width={64}
                            height={64}
                            fitMax
                            fillCell
                            keepAspectRatio
                            rounded={false}
                            className={cn(
                              "absolute inset-0 size-full min-h-0",
                              entry.kind === "removed" && "opacity-80",
                            )}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                            no fileId
                          </div>
                        )}
                      </LazyWhenVisible>
                      <span className="relative z-10 mt-0.5 w-full shrink-0 px-1 text-center text-xs text-muted-foreground">
                        {entry.id}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs font-mono text-xs">
                    <div>id={entry.id}</div>
                    {entry.fileId != null ? <div>fileId={entry.fileId}</div> : null}
                    {gv ? <div className="text-sky-300">{gv}</div> : null}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <TablePaginationBar
            pageSize={perPage}
            pageSizeOptions={TEXTURE_PER_PAGE_OPTIONS}
            onPageSizeChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingCount={paged.length}
            totalCount={filtered.length}
            countLabel="textures"
          />
        </div>
      )}

      {localModal != null ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setLocalModal(null);
          }}
        >
          <DialogContent
            className="flex h-[min(90vh,52rem)] w-full max-w-[min(100%,72rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-[min(100%,72rem)]"
            showCloseButton
          >
            <DialogTitle className="sr-only">Texture {localModal.id}</DialogTitle>
            <DiffTextureViewer
              textureDefinitionId={localModal.id}
              kind={localModal.kind}
              entries={localModal.entries}
              fileId={localModal.fileId}
              diffViewMode={diffViewMode}
              combinedRev={combinedRev}
              baseRev={baseRev}
              rev={rev}
              className="min-h-0"
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
