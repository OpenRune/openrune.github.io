"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { OptionDropdown } from "@/components/ui/option-dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCacheType } from "@/context/cache-type-context";
import { SPRITETYPES, useGamevals } from "@/context/gameval-context";
import { useSettings } from "@/context/settings-context";
import {
  cacheTexturesSnapshotUrl,
  combinedSpritesUrl,
  diffCacheOrderedPair,
  diffConfigContentUrl,
  diffDeltaSpritesUrl,
} from "@/lib/cache-api-client";
import type { DeltaBadgeMap } from "@/lib/diff-delta-merge";
import { conditionalJsonFetchAwaitingDecode } from "@/lib/diff-decode";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";
import type { NavSection } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

import { CONFIG_TYPES, DELTA_COUNTS, GAMEVAL_MIN_REVISION } from "./diff-constants";
import { idQueryMatchesNumericId } from "./diff-id-search";
import type { InspectorChangeEntry, InspectorChangeKind } from "./diff-inspector-panel";
import { pickDefaultArchiveTableSearchMode } from "./diff-search-modes";
import type { SectionSupportManifest } from "./diff-section-support";
import {
  matchesSpriteGamevalTags,
  spriteMatchesRegex,
  spriteMatchesSubstringName,
} from "./diff-sprite-gameval-filter";
import { DiffTypeIcon } from "./diff-type-icon";
import type { ConfigFilterMode, DiffMode, DiffSearchFieldMode, SearchTag, Section } from "./diff-types";
import { DiffUnifiedSearchField } from "./diff-unified-search-field";
import { ZipArchiveDownloadButton } from "./zip-archive-download-button";

/** Top-level repository groups (IntelliJ-style grid). */
export type DiffRepoCategory = "config" | "sprites" | "textures" | "interfaces";

type CategoryDef = {
  id: DiffRepoCategory;
  label: string;
  enabled: boolean;
};

const CATEGORIES: CategoryDef[] = [
  { id: "config", label: "Config", enabled: true },
  { id: "sprites", label: "Sprites", enabled: true },
  { id: "textures", label: "Textures", enabled: true },
  { id: "interfaces", label: "Interfaces", enabled: false },
];

type KindFilter = ConfigFilterMode;

function sentenceCaseNavLabel(raw: string): string {
  if (!raw) return raw;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function DiffNavDeltaBadges({ counts }: { counts: { added: number; changed: number; removed: number } }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
      {counts.added > 0 ? (
        <span className="rounded bg-green-600/90 px-1 text-[10px] font-medium text-white">+{counts.added}</span>
      ) : null}
      {counts.removed > 0 ? (
        <span className="rounded bg-red-600/90 px-1 text-[10px] font-medium text-white">−{counts.removed}</span>
      ) : null}
      {counts.changed > 0 ? (
        <span className="rounded bg-amber-600 px-1 text-[10px] font-medium text-amber-950">~{counts.changed}</span>
      ) : null}
    </span>
  );
}

function deltaTotal(counts: { added: number; changed: number; removed: number }): number {
  return counts.added + counts.changed + counts.removed;
}

function KindDot({ kind }: { kind: InspectorChangeKind }) {
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        kind === "added" && "bg-green-500",
        kind === "changed" && "bg-amber-500",
        kind === "removed" && "bg-red-500",
      )}
      title={kind}
    />
  );
}

type ConfigFileRow = {
  id: string;
  label: string;
  unsupported: boolean;
};

type DiffRepositoryPanelProps = {
  section: Section;
  setSection: (s: Section) => void;
  baseRev: number;
  rev: number;
  combinedRev: number;
  diffViewMode: DiffMode;
  deltaBadges?: DeltaBadgeMap | null;
  navSections?: { archives: NavSection[]; configs: NavSection[] } | null;
  sectionSupport?: SectionSupportManifest | null;
  /** When false, hide delta badges and treat Changes as empty (Full / no-compare). */
  showDeltas?: boolean;
  selectedEntryId?: number | null;
  onSelectArchiveEntry?: (entry: InspectorChangeEntry) => void;
  /** Shared sprites/textures search (also filters the main table). */
  archiveSearch?: {
    mode: DiffSearchFieldMode;
    onModeChange: (mode: DiffSearchFieldMode) => void;
    text: string;
    onTextChange: (text: string) => void;
    tags: SearchTag[];
    onTagsChange: (tags: SearchTag[]) => void;
    kind: KindFilter;
    onKindChange: (kind: KindFilter) => void;
  } | null;
};

function categoryForSection(section: Section): DiffRepoCategory {
  if (section === "sprites") return "sprites";
  if (section === "textures") return "textures";
  return "config";
}

function parseRemovedIds(removed: unknown): number[] {
  if (!Array.isArray(removed)) return [];
  return removed
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.trunc(n));
}

/** Full/combined texture list from `/cache?type=textures` snapshot keys. */
function textureEntriesFromSnapshot(data: Record<string, unknown> | null | undefined): InspectorChangeEntry[] {
  if (!data) return [];
  const snapshots =
    data.snapshots && typeof data.snapshots === "object" && !Array.isArray(data.snapshots)
      ? (data.snapshots as Record<string, unknown>)
      : null;
  if (!snapshots) return [];
  const out: InspectorChangeEntry[] = [];
  for (const [idRaw, snap] of Object.entries(snapshots)) {
    const id = Number(idRaw);
    if (!Number.isFinite(id) || !snap || typeof snap !== "object" || Array.isArray(snap)) continue;
    const def = snap as Record<string, unknown>;
    const fileIdRaw = def.fileId;
    const fileId =
      typeof fileIdRaw === "number" && Number.isFinite(fileIdRaw)
        ? Math.trunc(fileIdRaw)
        : typeof fileIdRaw === "string" && fileIdRaw.trim() !== "" && Number.isFinite(Number(fileIdRaw))
          ? Math.trunc(Number(fileIdRaw))
          : undefined;
    out.push({
      id: Math.trunc(id),
      kind: "changed",
      addedCount: 1,
      removedCount: 1,
      ...(fileId != null ? { gamevalId: fileId } : {}),
    });
  }
  return out.sort((a, b) => a.id - b.id);
}

function textureEntriesFromContent(data: {
  added?: Record<string, unknown>;
  changed?: Record<string, unknown>;
  removed?: unknown;
}): InspectorChangeEntry[] {
  const fileIdFromValue = (value: unknown): number | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const map = value as Record<string, unknown>;
    const raw = map.fileId;
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
    if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Math.trunc(Number(raw));
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const row = raw as { to?: unknown; from?: unknown };
      const to = typeof row.to === "number" ? row.to : Number(row.to);
      if (Number.isFinite(to)) return Math.trunc(to);
      const from = typeof row.from === "number" ? row.from : Number(row.from);
      if (Number.isFinite(from)) return Math.trunc(from);
    }
    return undefined;
  };

  const out: InspectorChangeEntry[] = [];
  for (const [idRaw, value] of Object.entries(data.added ?? {})) {
    const id = Number(idRaw);
    if (!Number.isFinite(id)) continue;
    const fileId = fileIdFromValue(value);
    out.push({
      id: Math.trunc(id),
      kind: "added",
      addedCount: 1,
      removedCount: 0,
      ...(fileId != null ? { gamevalId: fileId } : {}),
    });
  }
  for (const [idRaw, value] of Object.entries(data.changed ?? {})) {
    const id = Number(idRaw);
    if (!Number.isFinite(id)) continue;
    const fileId = fileIdFromValue(value);
    out.push({
      id: Math.trunc(id),
      kind: "changed",
      addedCount: 1,
      removedCount: 1,
      ...(fileId != null ? { gamevalId: fileId } : {}),
    });
  }
  for (const id of parseRemovedIds(data.removed)) {
    out.push({ id, kind: "removed", addedCount: 0, removedCount: 1 });
  }
  return out.sort((a, b) => a.id - b.id);
}

function spriteEntriesFromIds(ids: number[]): InspectorChangeEntry[] {
  return ids
    .slice()
    .sort((a, b) => a - b)
    .map((id) => ({ id, kind: "changed" as const, addedCount: 1, removedCount: 1 }));
}

function spriteEntriesFromDelta(data: {
  added?: number[];
  changed?: number[];
  removed?: number[];
}): InspectorChangeEntry[] {
  return [
    ...(data.added ?? []).map((id) => ({
      id,
      kind: "added" as const,
      addedCount: 1,
      removedCount: 0,
    })),
    ...(data.changed ?? []).map((id) => ({
      id,
      kind: "changed" as const,
      addedCount: 1,
      removedCount: 1,
    })),
    ...(data.removed ?? []).map((id) => ({
      id,
      kind: "removed" as const,
      addedCount: 0,
      removedCount: 1,
    })),
  ].sort((a, b) => a.id - b.id);
}

type ArchiveCat = "sprites" | "textures";
type ArchiveLoadStatus = "idle" | "loading" | "ok" | "error";

export function DiffRepositoryPanel({
  section,
  setSection,
  baseRev,
  rev,
  combinedRev,
  diffViewMode,
  deltaBadges = null,
  navSections = null,
  sectionSupport = null,
  showDeltas = true,
  selectedEntryId = null,
  onSelectArchiveEntry,
  archiveSearch = null,
}: DiffRepositoryPanelProps) {
  const { settings } = useSettings();
  const { selectedCacheType } = useCacheType();
  const { loadGamevalType, hasLoaded, lookupGameval, getGamevalExtra } = useGamevals();
  const [activeCategory, setActiveCategory] = React.useState<DiffRepoCategory>(() =>
    categoryForSection(section),
  );
  const [changesOnly, setChangesOnly] = React.useState(showDeltas);
  const [pathFilter, setPathFilter] = React.useState("");
  const [localArchiveSearchMode, setLocalArchiveSearchMode] = React.useState<DiffSearchFieldMode>("id");
  const [localArchiveSearchText, setLocalArchiveSearchText] = React.useState("");
  const [localArchiveTags, setLocalArchiveTags] = React.useState<SearchTag[]>([]);
  const [localKindFilter, setLocalKindFilter] = React.useState<KindFilter>("all");
  const [entriesByCat, setEntriesByCat] = React.useState<Record<ArchiveCat, InspectorChangeEntry[]>>({
    sprites: [],
    textures: [],
  });
  const [statusByCat, setStatusByCat] = React.useState<Record<ArchiveCat, ArchiveLoadStatus>>({
    sprites: "idle",
    textures: "idle",
  });
  const archivePrefetchSeq = React.useRef(0);

  const archiveSearchMode = archiveSearch?.mode ?? localArchiveSearchMode;
  const archiveSearchText = archiveSearch?.text ?? localArchiveSearchText;
  const archiveTags = archiveSearch?.tags ?? localArchiveTags;
  const kindFilter = archiveSearch?.kind ?? localKindFilter;

  const setArchiveSearchMode = React.useCallback(
    (next: DiffSearchFieldMode) => {
      if (archiveSearch) {
        archiveSearch.onModeChange(next);
        return;
      }
      setLocalArchiveSearchMode(next);
    },
    [archiveSearch],
  );
  const setArchiveSearchText = React.useCallback(
    (next: string) => {
      if (archiveSearch) {
        archiveSearch.onTextChange(next);
        return;
      }
      setLocalArchiveSearchText(next);
    },
    [archiveSearch],
  );
  const setArchiveTags = React.useCallback(
    (next: SearchTag[] | ((prev: SearchTag[]) => SearchTag[])) => {
      if (archiveSearch) {
        const resolved = typeof next === "function" ? next(archiveSearch.tags) : next;
        archiveSearch.onTagsChange(resolved);
        return;
      }
      setLocalArchiveTags(next);
    },
    [archiveSearch],
  );
  const setKindFilter = React.useCallback(
    (next: KindFilter) => {
      if (archiveSearch) {
        archiveSearch.onKindChange(next);
        return;
      }
      setLocalKindFilter(next);
    },
    [archiveSearch],
  );

  const archiveGamevalRev = diffViewMode === "combined" ? combinedRev : Math.max(baseRev, rev);
  const archiveGamevalSupported = archiveGamevalRev >= GAMEVAL_MIN_REVISION;

  const archiveSearchDisabledModes = React.useMemo((): readonly DiffSearchFieldMode[] => {
    const noNameRegex: DiffSearchFieldMode[] = ["name", "regex"];
    if (!archiveGamevalSupported) return ["gameval", ...noNameRegex];
    return noNameRegex;
  }, [archiveGamevalSupported]);

  const archiveSearchModeTitles = React.useMemo(() => {
    const revHint = `Needs revision ${GAMEVAL_MIN_REVISION}+ (current ${archiveGamevalRev}).`;
    const onlyIdGv = `${activeCategory === "textures" ? "Textures" : "Sprites"}: use ID or Gameval only.`;
    if (!archiveGamevalSupported) {
      return { gameval: revHint, name: revHint, regex: revHint } as const;
    }
    return { name: onlyIdGv, regex: onlyIdGv } as const;
  }, [activeCategory, archiveGamevalRev, archiveGamevalSupported]);

  React.useEffect(() => {
    setActiveCategory(categoryForSection(section));
  }, [section]);

  React.useEffect(() => {
    if (!showDeltas) setChangesOnly(false);
  }, [showDeltas]);

  React.useEffect(() => {
    if (archiveSearch) return;
    setArchiveSearchText("");
    setArchiveTags([]);
    setKindFilter("all");
    setArchiveSearchMode(pickDefaultArchiveTableSearchMode(archiveGamevalRev, archiveSearchDisabledModes));
  }, [
    activeCategory,
    archiveGamevalRev,
    archiveSearch,
    archiveSearchDisabledModes,
    setArchiveSearchMode,
    setArchiveSearchText,
    setArchiveTags,
    setKindFilter,
  ]);

  function deltaFor(key: string): { added: number; changed: number; removed: number } {
    const live = deltaBadges?.[key];
    if (live) return live;
    return DELTA_COUNTS[key] ?? { added: 0, changed: 0, removed: 0 };
  }

  const configSections: NavSection[] = React.useMemo(() => {
    const configs =
      navSections?.configs ?? CONFIG_TYPES.map((id) => ({ id, label: sentenceCaseNavLabel(id), apiType: id }));
    if (settings.hideNonTransmittedConfigs && sectionSupport) {
      return configs.filter(({ id }) => sectionSupport.configs[id] !== false);
    }
    return configs;
  }, [navSections, sectionSupport, settings.hideNonTransmittedConfigs]);

  const configRows = React.useMemo((): ConfigFileRow[] => {
    return configSections.map(({ id, label }) => ({
      id,
      label,
      unsupported: sectionSupport?.configs[id] === false,
    }));
  }, [configSections, sectionSupport]);

  const filteredConfigRows = React.useMemo(() => {
    const q = pathFilter.trim().toLowerCase();
    return configRows.filter((row) => {
      if (q && !row.id.toLowerCase().includes(q) && !row.label.toLowerCase().includes(q)) return false;
      if (changesOnly) {
        if (!showDeltas || row.unsupported) return false;
        return deltaTotal(deltaBadges?.[row.id] ?? { added: 0, changed: 0, removed: 0 }) > 0;
      }
      return true;
    });
  }, [changesOnly, configRows, deltaBadges, pathFilter, showDeltas]);

  const changedConfigCount = React.useMemo(() => {
    if (!showDeltas) return 0;
    return configRows.filter(
      (row) => !row.unsupported && deltaTotal(deltaBadges?.[row.id] ?? { added: 0, changed: 0, removed: 0 }) > 0,
    ).length;
  }, [configRows, deltaBadges, showDeltas]);

  const archiveLoadKeyRef = React.useRef<string>("");

  // Drop cached id lists when the revision pair / cache changes (counts stay on the manifest).
  React.useEffect(() => {
    archiveLoadKeyRef.current = "";
    setEntriesByCat({ sprites: [], textures: [] });
    setStatusByCat({ sprites: "idle", textures: "idle" });
    archivePrefetchSeq.current += 1;
  }, [baseRev, combinedRev, rev, selectedCacheType.id, showDeltas, diffViewMode]);

  // Load sprite/texture id lists only when that category is opened (counts come from support/delta manifests).
  React.useEffect(() => {
    if (activeCategory !== "sprites" && activeCategory !== "textures") return;

    const cat = activeCategory;
    const unsupported = sectionSupport?.archives[cat] === false;
    if (unsupported) {
      setEntriesByCat((prev) => ({ ...prev, [cat]: [] }));
      setStatusByCat((prev) => ({ ...prev, [cat]: "idle" }));
      return;
    }

    const listRev = diffViewMode === "combined" ? combinedRev : Math.max(baseRev, rev);
    const loadKey = `${cat}:${selectedCacheType.id}:${showDeltas ? 1 : 0}:${baseRev}:${rev}:${listRev}`;
    if (archiveLoadKeyRef.current === loadKey) return;
    archiveLoadKeyRef.current = loadKey;

    const seq = ++archivePrefetchSeq.current;
    const ac = new AbortController();
    setStatusByCat((prev) => ({ ...prev, [cat]: "loading" }));

    void (async () => {
      try {
        let next: InspectorChangeEntry[] = [];
        if (cat === "sprites") {
          if (showDeltas && baseRev !== rev) {
            const params = diffCacheOrderedPair(baseRev, rev);
            const key = `diff:delta:sprites:${selectedCacheType.id}:${params.base}:${params.rev}`;
            const { data } = await conditionalJsonFetchAwaitingDecode<{
              added?: number[];
              changed?: number[];
              removed?: number[];
            }>(key, diffDeltaSpritesUrl(selectedCacheType, params), {
              cacheType: selectedCacheType,
              signal: ac.signal,
            });
            next = spriteEntriesFromDelta(data ?? {});
          } else {
            const url = combinedSpritesUrl(selectedCacheType, listRev, 1);
            const key = `diff:combined:sprites:${selectedCacheType.id}:1:${listRev}`;
            const { data } = await conditionalJsonFetchAwaitingDecode<{
              spriteIds?: unknown;
              sprites?: unknown;
            }>(key, url, { cacheType: selectedCacheType, signal: ac.signal });
            const raw = Array.isArray(data?.spriteIds)
              ? data.spriteIds
              : Array.isArray(data?.sprites)
                ? data.sprites
                : [];
            const ids = raw
              .map((x) => (typeof x === "number" ? x : Number(x)))
              .filter((n) => Number.isFinite(n))
              .map((n) => Math.trunc(n));
            next = spriteEntriesFromIds(ids);
          }
        } else if (showDeltas && baseRev !== rev) {
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
          next = textureEntriesFromContent(data ?? {});
        } else {
          const { data } = await conditionalJsonFetch<Record<string, unknown>>(
            `cache:textures:snapshot:${selectedCacheType.id}:${listRev}`,
            cacheTexturesSnapshotUrl(selectedCacheType, listRev),
            { signal: ac.signal },
          );
          next = textureEntriesFromSnapshot(data);
        }

        if (seq !== archivePrefetchSeq.current) return;
        setEntriesByCat((prev) => ({ ...prev, [cat]: next }));
        setStatusByCat((prev) => ({ ...prev, [cat]: "ok" }));
      } catch {
        if (ac.signal.aborted || seq !== archivePrefetchSeq.current) return;
        archiveLoadKeyRef.current = "";
        setEntriesByCat((prev) => ({ ...prev, [cat]: [] }));
        setStatusByCat((prev) => ({ ...prev, [cat]: "error" }));
      }
    })();

    return () => ac.abort();
  }, [
    activeCategory,
    baseRev,
    combinedRev,
    diffViewMode,
    rev,
    sectionSupport,
    selectedCacheType,
    showDeltas,
  ]);

  React.useEffect(() => {
    if (activeCategory !== "sprites" && activeCategory !== "textures") return;
    if (archiveGamevalRev < GAMEVAL_MIN_REVISION) return;
    const q = archiveSearchText.trim();
    const needsLoad =
      (archiveSearchMode === "gameval" && archiveTags.length > 0) ||
      archiveSearchMode === "name" ||
      (archiveSearchMode === "regex" && q.length > 0);
    if (!needsLoad) return;
    void loadGamevalType(SPRITETYPES, archiveGamevalRev);
  }, [
    activeCategory,
    archiveGamevalRev,
    archiveSearchMode,
    archiveSearchText,
    archiveTags.length,
    loadGamevalType,
  ]);

  const isArchiveCategory = activeCategory === "sprites" || activeCategory === "textures";
  const archiveEntries = isArchiveCategory ? entriesByCat[activeCategory] : [];
  const archiveStatus = isArchiveCategory ? statusByCat[activeCategory] : "idle";

  const archiveKindCounts = React.useMemo(() => {
    let added = 0;
    let changed = 0;
    let removed = 0;
    for (const e of archiveEntries) {
      if (e.kind === "added") added += 1;
      else if (e.kind === "changed") changed += 1;
      else removed += 1;
    }
    return { added, changed, removed };
  }, [archiveEntries]);

  const gvFns = React.useMemo(
    () => ({ lookupGameval, getGamevalExtra }),
    [getGamevalExtra, lookupGameval],
  );

  const filteredArchiveEntries = React.useMemo(() => {
    const q = archiveSearchText.trim();
    const gvReady = archiveGamevalSupported && hasLoaded(SPRITETYPES, archiveGamevalRev);
    return archiveEntries.filter((entry) => {
      if (kindFilter !== "all" && entry.kind !== kindFilter) return false;
      const id = entry.gamevalId ?? entry.id;
      if (archiveSearchMode === "id") {
        return !q || idQueryMatchesNumericId(entry.id, q);
      }
      if (archiveSearchMode === "gameval") {
        if (archiveTags.length === 0) return true;
        if (!gvReady) return false;
        return matchesSpriteGamevalTags(SPRITETYPES, id, archiveTags, archiveGamevalRev, gvFns);
      }
      if (archiveSearchMode === "name") {
        if (!q) return true;
        if (!gvReady) return false;
        return spriteMatchesSubstringName(SPRITETYPES, id, q, archiveGamevalRev, gvFns);
      }
      if (archiveSearchMode === "regex") {
        if (!q) return true;
        if (!gvReady) return false;
        return spriteMatchesRegex(SPRITETYPES, id, q, archiveGamevalRev, gvFns);
      }
      return true;
    });
  }, [
    archiveEntries,
    archiveGamevalRev,
    archiveGamevalSupported,
    archiveSearchMode,
    archiveSearchText,
    archiveTags,
    gvFns,
    hasLoaded,
    kindFilter,
  ]);

  const categoryCounts = React.useMemo(() => {
    const archiveBadge = (cat: ArchiveCat): number => {
      if (sectionSupport?.archives[cat] === false) return 0;
      // Prefer live list length once opened; otherwise lightweight manifests.
      if (statusByCat[cat] === "ok") return entriesByCat[cat].length;
      if (showDeltas) {
        const badges = deltaBadges?.[cat];
        if (badges) return deltaTotal(badges);
      }
      const fromSupport = sectionSupport?.archiveCounts?.[cat];
      if (typeof fromSupport === "number") return fromSupport;
      return 0;
    };
    return {
      config: configRows.filter((r) => !(settings.hideNonTransmittedConfigs && r.unsupported)).length,
      sprites: archiveBadge("sprites"),
      textures: archiveBadge("textures"),
      interfaces: 0,
    } satisfies Record<DiffRepoCategory, number>;
  }, [
    configRows,
    deltaBadges,
    entriesByCat,
    sectionSupport,
    settings.hideNonTransmittedConfigs,
    showDeltas,
    statusByCat,
  ]);

  function selectCategory(cat: CategoryDef) {
    if (!cat.enabled) return;
    setActiveCategory(cat.id);
    if (cat.id === "sprites") {
      setSection("sprites");
      return;
    }
    if (cat.id === "textures") {
      setSection("textures");
      return;
    }
    if (cat.id === "config" && categoryForSection(section) !== "config") {
      const first = configRows.find((r) => !r.unsupported)?.id;
      if (first) setSection(first as Section);
    }
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-muted/20">
      <header className="shrink-0 border-b px-3 py-2">
        <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Repository
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 space-y-2 px-2 pb-2 pt-3">
          <div className="grid grid-cols-2 gap-x-1 gap-y-0.5">
            {CATEGORIES.map((cat) => {
              const active = cat.enabled && activeCategory === cat.id;
              const count = categoryCounts[cat.id];
              const button = (
                <button
                  key={cat.id}
                  type="button"
                  disabled={!cat.enabled}
                  onClick={() => selectCategory(cat)}
                  aria-pressed={active}
                  className={cn(
                    "flex h-8 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    !cat.enabled &&
                      "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground",
                  )}
                >
                  <span className="truncate font-medium">{cat.label}</span>
                  <span
                    className={cn(
                      "shrink-0 tabular-nums text-[11px]",
                      active ? "text-muted-foreground" : "text-muted-foreground/70",
                    )}
                  >
                    {cat.enabled ? count : "—"}
                  </span>
                </button>
              );
              if (!cat.enabled) {
                return (
                  <Tooltip key={cat.id}>
                    <TooltipTrigger render={<span className="block">{button}</span>} />
                    <TooltipContent opaque side="bottom" className="text-xs">
                      Coming in a later Diff phase.
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return button;
            })}
          </div>

          {isArchiveCategory ? (
            <div className="flex min-w-0 items-start gap-1.5">
              <DiffUnifiedSearchField
                className="min-w-0 flex-1"
                size="default"
                mode={archiveSearchMode}
                onModeChange={setArchiveSearchMode}
                disabledModes={archiveSearchDisabledModes}
                modeOptionTitles={archiveSearchModeTitles}
                tagModes={["gameval"]}
                value={archiveSearchText}
                onChange={(e) => setArchiveSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && archiveSearchMode === "gameval" && archiveSearchText.trim()) {
                    e.preventDefault();
                    setArchiveTags((prev) => [...prev, { value: archiveSearchText.trim(), exact: false }]);
                    setArchiveSearchText("");
                  }
                }}
                tags={archiveTags}
                onTagToggle={(idx) =>
                  setArchiveTags((prev) => prev.map((t, i) => (i === idx ? { ...t, exact: !t.exact } : t)))
                }
                onTagRemove={(idx) => setArchiveTags((prev) => prev.filter((_, i) => i !== idx))}
                onClearTags={() => setArchiveTags([])}
                gamevalAutocomplete={{
                  type: SPRITETYPES,
                  rev: archiveGamevalRev,
                  enabled:
                    archiveGamevalSupported &&
                    (activeCategory === "sprites"
                      ? settings.suggestionDisplay.sprites
                      : settings.suggestionDisplay.textures),
                }}
              />
              {showDeltas && baseRev !== rev ? (
                <OptionDropdown
                  className="w-[5.5rem] shrink-0"
                  buttonClassName="!h-10 px-1.5 text-[11px]"
                  menuMinWidthPx={112}
                  labelClassName="truncate"
                  ariaLabel={`${activeCategory} change type filter`}
                  value={kindFilter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "added", label: "Added" },
                    { value: "changed", label: "Changed" },
                    { value: "removed", label: "Removed" },
                  ]}
                  onChange={(v) => setKindFilter(v as KindFilter)}
                />
              ) : null}
            </div>
          ) : (
            <Input
              value={pathFilter}
              onChange={(e) => setPathFilter(e.target.value)}
              placeholder="Filter…"
              className="h-8 text-xs"
              aria-label="Filter repository paths"
            />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-y border-border/60 px-3 py-1.5">
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase tabular-nums">
            {isArchiveCategory
              ? `${filteredArchiveEntries.length} ${filteredArchiveEntries.length === 1 ? "id" : "ids"}`
              : `${filteredConfigRows.length} ${filteredConfigRows.length === 1 ? "file" : "files"}`}
          </span>
          {!isArchiveCategory && showDeltas ? (
            <button
              type="button"
              onClick={() => setChangesOnly((v) => !v)}
              className={cn(
                "text-[10px] font-semibold tracking-wide uppercase tabular-nums transition-colors",
                changesOnly ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {changedConfigCount} changed
            </button>
          ) : isArchiveCategory && showDeltas && baseRev !== rev ? (
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase tabular-nums">
              +{archiveKindCounts.added}/~{archiveKindCounts.changed}/−{archiveKindCounts.removed}
            </span>
          ) : (
            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground/50 uppercase">
              full
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          {isArchiveCategory ? (
            <ArchiveEntryList
              entries={filteredArchiveEntries}
              status={archiveStatus}
              category={activeCategory}
              selectedId={selectedEntryId}
              lookupName={(id) => lookupGameval(SPRITETYPES, id, archiveGamevalRev)}
              onSelect={(entry) => onSelectArchiveEntry?.(entry)}
            />
          ) : (
            <ConfigFileList
              rows={filteredConfigRows}
              section={section}
              setSection={setSection}
              deltaFor={deltaFor}
              showDeltas={showDeltas}
              emptyLabel={
                changesOnly
                  ? showDeltas
                    ? "No changes in this group."
                    : "Switch to Diff to see changes between revisions."
                  : "No files match."
              }
            />
          )}
        </div>

        {isArchiveCategory ? (
          <div className="shrink-0 border-t bg-muted/20 p-2">
            <ZipArchiveDownloadButton
              className="w-full justify-center"
              kind={activeCategory === "textures" ? "textures" : "sprites"}
              diffViewMode={diffViewMode}
              combinedRev={combinedRev}
              baseRev={baseRev}
              rev={rev}
              tableBase={1}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function ConfigFileList({
  rows,
  section,
  setSection,
  deltaFor,
  showDeltas,
  emptyLabel = "No files match.",
}: {
  rows: ConfigFileRow[];
  section: Section;
  setSection: (s: Section) => void;
  deltaFor: (key: string) => { added: number; changed: number; removed: number };
  showDeltas: boolean;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="px-2 py-4 text-center text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row) => {
        const counts = deltaFor(row.id);
        const active = section === row.id;
        const hasDelta = showDeltas && !row.unsupported && deltaTotal(counts) > 0;
        const button = (
          <button
            type="button"
            disabled={row.unsupported}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left font-mono text-[12px] leading-5 transition-colors",
              active
                ? "bg-muted text-foreground"
                : hasDelta
                  ? "text-foreground/90 hover:bg-muted/60"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              row.unsupported && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
            onClick={() => setSection(row.id as Section)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="inline-flex size-3.5 shrink-0 items-center justify-center opacity-70 [&_svg]:size-3.5">
                <DiffTypeIcon type={row.id as Section} />
              </span>
              <span className="truncate">{row.id}</span>
            </span>
            {hasDelta ? <DiffNavDeltaBadges counts={counts} /> : null}
          </button>
        );

        if (row.unsupported) {
          return (
            <li key={row.id}>
              <Tooltip>
                <TooltipTrigger render={<span className="block w-full">{button}</span>} />
                <TooltipContent opaque side="right" className="text-xs">
                  Not supported for the selected revision.
                </TooltipContent>
              </Tooltip>
            </li>
          );
        }

        return <li key={row.id}>{button}</li>;
      })}
    </ul>
  );
}

function ArchiveEntryList({
  entries,
  status,
  category,
  selectedId,
  lookupName,
  onSelect,
}: {
  entries: InspectorChangeEntry[];
  status: "idle" | "loading" | "ok" | "error";
  category: "sprites" | "textures";
  selectedId: number | null;
  lookupName: (id: number) => string | undefined;
  onSelect: (entry: InspectorChangeEntry) => void;
}) {
  if (status === "loading") {
    return <p className="px-2 py-4 text-center text-xs text-muted-foreground">Loading…</p>;
  }
  if (status === "error") {
    return <p className="px-2 py-4 text-center text-xs text-destructive">Failed to load {category}.</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-xs text-muted-foreground">
        No {category} match.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {entries.map((entry) => {
        const active = selectedId === entry.id;
        const name = lookupName(entry.gamevalId ?? entry.id);
        return (
          <li key={`${entry.kind}-${entry.id}`}>
            <button
              type="button"
              data-repo-entry-active={active ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left font-mono text-[12px] leading-5 transition-colors",
                active ? "bg-muted text-foreground" : "text-foreground/90 hover:bg-muted/60",
              )}
              onClick={() => onSelect(entry)}
            >
              <KindDot kind={entry.kind} />
              <span className="min-w-0 flex-1 truncate">
                <span className="tabular-nums">{entry.id}</span>
                {name ? <span className="text-muted-foreground"> · {name}</span> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
