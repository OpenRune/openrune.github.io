"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCacheType } from "@/context/cache-type-context";
import { SPRITETYPES, useGamevals, type GamevalType } from "@/context/gameval-context";
import {
  cacheTexturesSnapshotUrl,
  diffCacheOrderedPair,
  diffConfigContentUrl,
  diffDeltaSpritesUrl,
  diffSpriteImageUrl,
} from "@/lib/cache-api-client";
import type { DeltaBadgeCounts } from "@/lib/diff-delta-merge";
import { conditionalJsonFetchAwaitingDecode } from "@/lib/diff-decode";
import { GAMEVAL_MIN_REVISION, GAMEVAL_VARCS_MIN_REVISION } from "@/lib/gameval-revisions";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";
import { cn } from "@/lib/utils";

import { sectionGamevalTypeForSection, sectionPrefixForConfigType } from "./diff-constants";
import type { Section } from "./diff-types";

export type InspectorChangeKind = "added" | "changed" | "removed";

export type InspectorChangeEntry = {
  id: number;
  kind: InspectorChangeKind;
  /** Compact field preview for changed/added entries. */
  preview?: string;
  addedCount: number;
  removedCount: number;
  /**
   * Id used for gameval lookup when it differs from `id`
   * (textures: sprite `fileId`).
   */
  gamevalId?: number;
  /** Resolved gameval name when known (preferred for focus / share links). */
  gameval?: string | null;
};

type ConfigContentPayload = {
  added?: Record<string, unknown>;
  removed?: unknown;
  changed?: Record<string, unknown>;
};

type DiffInspectorPanelProps = {
  section: Section;
  sectionLabel?: string;
  baseRev: number;
  rev: number;
  deltaCounts: DeltaBadgeCounts | null;
  unsupported: boolean;
  selectedChangeId: number | null;
  onSelectChange: (entry: InspectorChangeEntry | null) => void;
  /** When false (Full / no-compare), skip change loading and hide Changes tab. */
  compareEnabled?: boolean;
};

function formatFieldPreview(value: unknown, maxLen = 120): string {
  if (value == null) return "";
  if (typeof value === "string") return value.length > maxLen ? `${value.slice(0, maxLen)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    try {
      const s = JSON.stringify(value);
      return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
    } catch {
      return "";
    }
  }
  return String(value);
}

function fieldCount(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 1;
  const n = Object.keys(value as object).length;
  return n > 0 ? n : 1;
}

function changedPreview(fields: unknown): string | undefined {
  if (!fields || typeof fields !== "object") return undefined;
  const entries = Object.entries(fields as Record<string, unknown>).slice(0, 4);
  if (entries.length === 0) return undefined;
  return entries
    .map(([key, val]) => {
      if (val && typeof val === "object" && "from" in (val as object) && "to" in (val as object)) {
        const row = val as { from: unknown; to: unknown };
        return `${key}: ${formatFieldPreview(row.from, 40)} → ${formatFieldPreview(row.to, 40)}`;
      }
      return `${key}: ${formatFieldPreview(val, 48)}`;
    })
    .join(" · ");
}

function parseRemovedIds(removed: unknown): number[] {
  if (!Array.isArray(removed)) return [];
  return removed
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n));
}

const TEXTURE_FILE_ID_KEYS = ["fileId", "file_id", "spriteId", "sprite_id", "fileID", "spriteID", "fileid"] as const;

function coerceFiniteId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Prefer the “after” / current fileId when present in added or changed field payloads. */
function extractTextureFileId(fields: unknown): number | null {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;
  const map = fields as Record<string, unknown>;
  for (const key of TEXTURE_FILE_ID_KEYS) {
    if (!(key in map)) continue;
    const raw = map[key];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const row = raw as { to?: unknown; from?: unknown };
      const to = coerceFiniteId(row.to);
      if (to != null) return to;
      const from = coerceFiniteId(row.from);
      if (from != null) return from;
      continue;
    }
    const direct = coerceFiniteId(raw);
    if (direct != null) return direct;
  }
  return null;
}

function textureFileIdMapFromSnapshot(data: Record<string, unknown> | null | undefined): Map<number, number> {
  const out = new Map<number, number>();
  if (!data) return out;
  const snapshots =
    data.snapshots && typeof data.snapshots === "object" && !Array.isArray(data.snapshots)
      ? (data.snapshots as Record<string, unknown>)
      : null;
  if (!snapshots) return out;
  for (const [idRaw, snap] of Object.entries(snapshots)) {
    const id = Number(idRaw);
    if (!Number.isFinite(id) || !snap || typeof snap !== "object" || Array.isArray(snap)) continue;
    const def = snap as Record<string, unknown>;
    for (const key of TEXTURE_FILE_ID_KEYS) {
      const fileId = coerceFiniteId(def[key]);
      if (fileId != null && fileId >= 0) {
        out.set(id, fileId);
        break;
      }
    }
  }
  return out;
}

function parseIdMap(
  map: Record<string, unknown> | undefined,
  kind: InspectorChangeKind,
  opts?: { extractGamevalId?: (value: unknown) => number | null },
): InspectorChangeEntry[] {
  if (!map) return [];
  const out: InspectorChangeEntry[] = [];
  for (const [idRaw, value] of Object.entries(map)) {
    const id = Number(idRaw);
    if (!Number.isFinite(id)) continue;
    const preview =
      kind === "changed"
        ? changedPreview(value)
        : kind === "added"
          ? formatFieldPreview(value, 96) || undefined
          : undefined;
    const count = fieldCount(value);
    const gamevalId = opts?.extractGamevalId?.(value) ?? undefined;
    out.push({
      id,
      kind,
      preview,
      addedCount: kind === "removed" ? 0 : count,
      removedCount: kind === "added" ? 0 : kind === "removed" ? count : Math.max(0, Math.floor(count / 2)),
      ...(gamevalId != null ? { gamevalId } : {}),
    });
  }
  return out.sort((a, b) => a.id - b.id);
}

function entriesFromConfigContent(
  payload: ConfigContentPayload,
  opts?: { extractGamevalId?: (value: unknown) => number | null },
): InspectorChangeEntry[] {
  return [
    ...parseIdMap(payload.added as Record<string, unknown> | undefined, "added", opts),
    ...parseIdMap(payload.changed as Record<string, unknown> | undefined, "changed", opts),
    ...parseRemovedIds(payload.removed).map((id) => ({
      id,
      kind: "removed" as const,
      addedCount: 0,
      removedCount: 1,
    })),
  ];
}

function applyTextureFileIds(
  entries: InspectorChangeEntry[],
  newerMap: Map<number, number>,
  olderMap: Map<number, number>,
): InspectorChangeEntry[] {
  return entries.map((entry) => {
    if (entry.gamevalId != null) return entry;
    const fromNewer = newerMap.get(entry.id);
    if (fromNewer != null) return { ...entry, gamevalId: fromNewer };
    const fromOlder = olderMap.get(entry.id);
    if (fromOlder != null) return { ...entry, gamevalId: fromOlder };
    return entry;
  });
}

function KindGlyph({ kind }: { kind: InspectorChangeKind }) {
  const label = kind === "added" ? "A" : kind === "removed" ? "D" : "M";
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold text-white",
        kind === "added" && "bg-green-600",
        kind === "removed" && "bg-red-600",
        kind === "changed" && "bg-amber-500 text-amber-950",
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}

function ChangePreviewThumb({
  kind,
  src,
}: {
  kind: InspectorChangeKind;
  src: string;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) return <KindGlyph kind={kind} />;

  return (
    <span
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border bg-black/40",
        kind === "added" && "border-green-600/70",
        kind === "removed" && "border-red-600/70",
        kind === "changed" && "border-amber-500/70",
      )}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-h-full max-w-full object-contain"
        style={{ imageRendering: "pixelated" }}
        decoding="async"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

function gamevalTypeForInspectorSection(section: Section): GamevalType | null {
  if (section === "sprites" || section === "textures") return SPRITETYPES;
  return sectionGamevalTypeForSection(section);
}

function gamevalMinRevForType(type: GamevalType): number {
  return type === "varcs" ? GAMEVAL_VARCS_MIN_REVISION : GAMEVAL_MIN_REVISION;
}

export function DiffInspectorPanel({
  section,
  sectionLabel,
  baseRev,
  rev,
  deltaCounts,
  unsupported,
  selectedChangeId,
  onSelectChange,
  compareEnabled = true,
}: DiffInspectorPanelProps) {
  const { selectedCacheType } = useCacheType();
  const { loadGamevalType, lookupGameval, getGamevalExtra } = useGamevals();
  const [inspectorTab, setInspectorTab] = React.useState<"file" | "changes">(
    compareEnabled ? "changes" : "file",
  );
  const [entries, setEntries] = React.useState<InspectorChangeEntry[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [changeFilter, setChangeFilter] = React.useState<"all" | InspectorChangeKind>("all");
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const fetchSeq = React.useRef(0);

  const displayName = sectionLabel ?? section;
  const idPrefix = sectionPrefixForConfigType(section);
  const gamevalType = gamevalTypeForInspectorSection(section);
  const newerRev = Math.max(baseRev, rev);
  const olderRev = Math.min(baseRev, rev);
  const gamevalMinRev = gamevalType ? gamevalMinRevForType(gamevalType) : Number.POSITIVE_INFINITY;

  React.useEffect(() => {
    if (!gamevalType) return;
    if (newerRev >= gamevalMinRev) void loadGamevalType(gamevalType, newerRev);
    if (olderRev !== newerRev && olderRev >= gamevalMinRev) {
      void loadGamevalType(gamevalType, olderRev);
    }
  }, [gamevalMinRev, gamevalType, loadGamevalType, newerRev, olderRev]);

  const resolveGameval = React.useCallback(
    (entry: InspectorChangeEntry): string | null => {
      if (!gamevalType) return null;
      const lookupId = entry.gamevalId ?? (section === "textures" ? null : entry.id);
      if (lookupId == null) return null;
      const pick = (r: number) =>
        lookupGameval(gamevalType, lookupId, r)?.trim() ||
        getGamevalExtra(gamevalType, lookupId, r)?.searchable?.trim() ||
        null;
      if (newerRev >= gamevalMinRev) {
        const fromNewer = pick(newerRev);
        if (fromNewer) return fromNewer;
      }
      if (olderRev !== newerRev && olderRev >= gamevalMinRev) {
        return pick(olderRev);
      }
      return null;
    },
    [gamevalMinRev, gamevalType, getGamevalExtra, lookupGameval, newerRev, olderRev, section],
  );

  React.useEffect(() => {
    onSelectChange(null);
    setChangeFilter("all");
    setInspectorTab(compareEnabled ? "changes" : "file");
  }, [section, baseRev, rev, onSelectChange, compareEnabled]);

  React.useEffect(() => {
    if (!compareEnabled || unsupported || baseRev === rev) {
      setEntries([]);
      setStatus("idle");
      setError(null);
      return;
    }

    const seq = ++fetchSeq.current;
    const params = diffCacheOrderedPair(baseRev, rev);
    const ac = new AbortController();
    setStatus("loading");
    setError(null);

    void (async () => {
      try {
        if (section === "sprites") {
          const key = `diff:delta:sprites:${selectedCacheType.id}:${params.base}:${params.rev}`;
          const { data } = await conditionalJsonFetchAwaitingDecode<{
            added?: number[];
            changed?: number[];
            removed?: number[];
          }>(key, diffDeltaSpritesUrl(selectedCacheType, params), {
            cacheType: selectedCacheType,
            signal: ac.signal,
          });
          if (seq !== fetchSeq.current) return;
          const next: InspectorChangeEntry[] = [
            ...(data?.added ?? []).map((id) => ({
              id,
              kind: "added" as const,
              addedCount: 1,
              removedCount: 0,
            })),
            ...(data?.changed ?? []).map((id) => ({
              id,
              kind: "changed" as const,
              addedCount: 1,
              removedCount: 1,
            })),
            ...(data?.removed ?? []).map((id) => ({
              id,
              kind: "removed" as const,
              addedCount: 0,
              removedCount: 1,
            })),
          ].sort((a, b) => a.id - b.id);
          setEntries(next);
          setStatus("ok");
          return;
        }

        const key = `diff:config:content:${selectedCacheType.id}:${section}:${params.base}:${params.rev}`;
        const { data } = await conditionalJsonFetchAwaitingDecode<ConfigContentPayload>(
          key,
          diffConfigContentUrl(selectedCacheType, section, params),
          {
            cacheType: selectedCacheType,
            signal: ac.signal,
          },
        );
        if (seq !== fetchSeq.current) return;

        if (section === "textures") {
          let next = entriesFromConfigContent(data ?? {}, {
            extractGamevalId: extractTextureFileId,
          });
          const needsSnapshot = next.some((e) => e.gamevalId == null);
          if (needsSnapshot) {
            const [newerSnap, olderSnap] = await Promise.all([
              conditionalJsonFetch<Record<string, unknown>>(
                `cache:textures:snapshot:${selectedCacheType.id}:${params.rev}`,
                cacheTexturesSnapshotUrl(selectedCacheType, params.rev),
                { signal: ac.signal },
              ).catch(() => ({ data: null as Record<string, unknown> | null })),
              params.base !== params.rev
                ? conditionalJsonFetch<Record<string, unknown>>(
                    `cache:textures:snapshot:${selectedCacheType.id}:${params.base}`,
                    cacheTexturesSnapshotUrl(selectedCacheType, params.base),
                    { signal: ac.signal },
                  ).catch(() => ({ data: null as Record<string, unknown> | null }))
                : Promise.resolve({ data: null as Record<string, unknown> | null }),
            ]);
            if (seq !== fetchSeq.current) return;
            next = applyTextureFileIds(
              next,
              textureFileIdMapFromSnapshot(newerSnap.data ?? undefined),
              textureFileIdMapFromSnapshot(olderSnap.data ?? undefined),
            );
          }
          setEntries(next);
          setStatus("ok");
          return;
        }

        setEntries(entriesFromConfigContent(data ?? {}));
        setStatus("ok");
      } catch (e) {
        if (ac.signal.aborted || seq !== fetchSeq.current) return;
        setEntries([]);
        setStatus("error");
        setError(e instanceof Error ? e.message : "Failed to load changes");
      }
    })();

    return () => ac.abort();
  }, [baseRev, compareEnabled, rev, section, selectedCacheType, unsupported]);

  const counts = React.useMemo(() => {
    let added = 0;
    let changed = 0;
    let removed = 0;
    for (const e of entries) {
      if (e.kind === "added") added += 1;
      else if (e.kind === "changed") changed += 1;
      else removed += 1;
    }
    if (entries.length === 0 && deltaCounts) {
      return deltaCounts;
    }
    return { added, changed, removed };
  }, [deltaCounts, entries]);

  const filteredEntries = React.useMemo(() => {
    if (changeFilter === "all") return entries;
    return entries.filter((e) => e.kind === changeFilter);
  }, [changeFilter, entries]);

  const hopToKind = React.useCallback(
    (kind: InspectorChangeKind) => {
      setInspectorTab("changes");
      setChangeFilter((prev) => (prev === kind ? "all" : kind));
      const nextFilter = changeFilter === kind ? "all" : kind;
      const pool = nextFilter === "all" ? entries : entries.filter((e) => e.kind === kind);
      const first = pool[0] ?? null;
      onSelectChange(
        first
          ? { ...first, gameval: resolveGameval(first) }
          : null,
      );
      requestAnimationFrame(() => {
        const el = listRef.current?.querySelector<HTMLElement>("[data-inspector-active='true']");
        el?.scrollIntoView({ block: "nearest" });
      });
    },
    [changeFilter, entries, onSelectChange, resolveGameval],
  );

  const selectEntry = React.useCallback(
    (entry: InspectorChangeEntry) => {
      onSelectChange({ ...entry, gameval: resolveGameval(entry) });
      setInspectorTab("changes");
      requestAnimationFrame(() => {
        const el = listRef.current?.querySelector<HTMLElement>("[data-inspector-active='true']");
        el?.scrollIntoView({ block: "nearest" });
      });
    },
    [onSelectChange, resolveGameval],
  );

  const changeTotal = counts.added + counts.changed + counts.removed;
  const orderedPair = React.useMemo(() => diffCacheOrderedPair(baseRev, rev), [baseRev, rev]);
  const showImagePreview = section === "sprites" || section === "textures";

  const previewSrcForEntry = React.useCallback(
    (entry: InspectorChangeEntry): string | null => {
      if (!showImagePreview) return null;
      const spriteId = section === "sprites" ? entry.id : entry.gamevalId;
      if (spriteId == null) return null;
      const source = entry.kind === "removed" ? orderedPair.base : orderedPair.rev;
      return diffSpriteImageUrl(selectedCacheType, spriteId, { ...orderedPair, source });
    },
    [orderedPair, section, selectedCacheType, showImagePreview],
  );

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-muted/20">
      <header className="shrink-0 border-b px-3 py-2.5">
        <div className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Inspector
        </div>
        <div className="text-sm font-semibold tracking-tight">Details</div>
      </header>

      <Tabs
        value={inspectorTab}
        onValueChange={(v) => setInspectorTab(v as "file" | "changes")}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="mx-2 mt-2 flex h-9 w-[calc(100%-1rem)] shrink-0 gap-1 rounded-lg border bg-muted/50 p-1">
          <TabsTrigger
            value="file"
            className="h-full flex-1 rounded-md text-xs font-medium shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            File
          </TabsTrigger>
          {compareEnabled ? (
            <TabsTrigger
              value="changes"
              className="h-full flex-1 gap-1.5 rounded-md text-xs font-medium shadow-none data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Changes
              {changeTotal > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-muted px-1.5 text-[10px] font-semibold text-foreground">
                  {changeTotal > 99 ? "99+" : changeTotal}
                </span>
              ) : null}
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="file" className="mt-0 min-h-0 flex-1 overflow-y-auto px-3 py-3 text-sm">
          <dl className="space-y-3">
            <div>
              <dt className="text-[11px] text-muted-foreground">Type</dt>
              <dd className="font-medium">{displayName}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Path</dt>
              <dd className="font-mono text-xs">{section}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">{compareEnabled ? "Compare" : "Cache"}</dt>
              <dd className="text-xs">
                {compareEnabled ? (
                  <>
                    {baseRev} → {rev}
                  </>
                ) : (
                  <>{rev}</>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Support</dt>
              <dd className="text-xs">{unsupported ? "Unsupported at compare rev" : "Available"}</dd>
            </div>
          </dl>
        </TabsContent>

        {compareEnabled ? (
          <TabsContent value="changes" className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 space-y-2 border-b px-3 py-2.5">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-center rounded-md border px-2 py-1.5 text-xs font-semibold tabular-nums transition-colors",
                    "border-green-600/40 text-green-500 hover:bg-green-600/10",
                    changeFilter === "added" && "bg-green-600/20 ring-1 ring-green-500/50",
                  )}
                  onClick={() => hopToKind("added")}
                  aria-pressed={changeFilter === "added"}
                  title="Show added · click again for all"
                >
                  +{counts.added}
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-center rounded-md border px-2 py-1.5 text-xs font-semibold tabular-nums transition-colors",
                    "border-amber-500/40 text-amber-400 hover:bg-amber-500/10",
                    changeFilter === "changed" && "bg-amber-500/20 ring-1 ring-amber-400/50",
                  )}
                  onClick={() => hopToKind("changed")}
                  aria-pressed={changeFilter === "changed"}
                  title="Show changed · click again for all"
                >
                  ~{counts.changed}
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex items-center justify-center rounded-md border px-2 py-1.5 text-xs font-semibold tabular-nums transition-colors",
                    "border-red-600/40 text-red-400 hover:bg-red-600/10",
                    changeFilter === "removed" && "bg-red-600/20 ring-1 ring-red-500/50",
                  )}
                  onClick={() => hopToKind("removed")}
                  aria-pressed={changeFilter === "removed"}
                  title="Show removed · click again for all"
                >
                  −{counts.removed}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground">
                <span className="text-green-500/90">Added</span>
                <span className="text-amber-400/90">Changed</span>
                <span className="text-red-400/90">Removed</span>
              </div>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1.5">
              {unsupported ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">Not supported for this revision.</p>
              ) : status === "loading" ? (
                <div className="space-y-2 p-2" aria-busy="true">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" delayMs={40} />
                  <Skeleton className="h-10 w-full" delayMs={80} />
                </div>
              ) : status === "error" ? (
                <p className="px-2 py-3 text-xs text-destructive">{error ?? "Failed to load"}</p>
              ) : filteredEntries.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">No id-level changes.</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {filteredEntries.map((entry) => {
                    const active = selectedChangeId === entry.id;
                    const gameval = resolveGameval(entry);
                    const title = gameval || `${idPrefix}_${entry.id}`;
                    const previewSrc = previewSrcForEntry(entry);
                    return (
                      <li key={`${entry.kind}-${entry.id}`}>
                        <button
                          type="button"
                          data-inspector-active={active ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                            active
                              ? "bg-muted ring-1 ring-inset ring-primary/40"
                              : "hover:bg-muted/70",
                          )}
                          onClick={() => selectEntry(entry)}
                        >
                          {previewSrc ? (
                            <ChangePreviewThumb kind={entry.kind} src={previewSrc} />
                          ) : (
                            <KindGlyph kind={entry.kind} />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-mono text-xs font-medium">{title}</span>
                            <span className="mt-0.5 block text-[10px] tabular-nums text-muted-foreground">
                              {gameval ? (
                                <>
                                  <span>{entry.id}</span>
                                  {" · "}
                                </>
                              ) : null}
                              <span className="text-green-500">+{entry.addedCount}</span>
                              {" / "}
                              <span className="text-red-400">−{entry.removedCount}</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </aside>
  );
}
