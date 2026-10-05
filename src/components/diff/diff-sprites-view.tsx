"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LazyWhenVisible } from "@/components/ui/lazy-when-visible";
import { OptionDropdown } from "@/components/ui/option-dropdown";
import { RSSprite } from "@/components/ui/RSSprite";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePaginationBar } from "@/components/ui/table-pagination-bar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCacheType } from "@/context/cache-type-context";
import { useSettings } from "@/context/settings-context";
import { SPRITETYPES, useGamevals } from "@/context/gameval-context";
import {
  combinedSpritesUrl,
  diffCacheOrderedPair,
  diffDeltaSpritesUrl,
  diffSpriteImageUrl,
} from "@/lib/cache-api-client";
import { DiffDecodeProgressBanner } from "@/components/diff/diff-decode-progress";
import {
  conditionalJsonFetchAwaitingDecode,
  isDiffDecodePayload,
  type DiffDecodeProgress,
} from "@/lib/diff-decode";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DIFF_COMBINED_SEARCH_WRAP_CLASS, GAMEVAL_MIN_REVISION, SPRITE_PER_PAGE_OPTIONS } from "./diff-constants";
import { DiffArchiveTable } from "./diff-archive-table";
import { diffSearchModeTooltipHelp, pickDefaultArchiveTableSearchMode } from "./diff-search-modes";
import { DiffSectionHeader } from "./diff-section-header";
import { ZipArchiveDownloadButton } from "./zip-archive-download-button";
import { DiffUnifiedSearchField } from "./diff-unified-search-field";
import { DiffViewModeToggle } from "./diff-view-mode-toggle";
import {
  matchesSpriteGamevalTags,
  spriteMatchesRegex,
  spriteMatchesSubstringName,
} from "./diff-sprite-gameval-filter";
import { idQueryMatchesNumericId, looksLikeSpriteIdQueryText } from "./diff-id-search";
import { CombinedSpriteGridTile, CombinedSpriteTableRow } from "./diff-sprites-combined-rows";
import { DiffSpritePngViewer } from "./diff-sprite-png-viewer";
import { clearSpriteViewerParams, parseSpriteViewerUrlState } from "./diff-sprite-viewer-url";
import {
  DIFF_ARCHIVE_TABLE_CELL_CLASS,
  DIFF_ARCHIVE_TABLE_HEAD_CLASS,
  DIFF_ARCHIVE_TABLE_HEADER_CLASS,
} from "./diff-table-archive-styles";
import type { ConfigFilterMode, DiffMode, DiffSearchFieldMode, SearchTag, SpriteDiffEntry } from "./diff-types";

const COMBINED_SPRITE_BASE = 1;
const COMBINED_GRID_SKELETON_CELLS = 28;
/** Quiet period after page changes before mounting the next page of thumbnails (rapid paging). */
const SPRITE_PAGE_DEBOUNCE_MS = 200;
/** Diff-mode sprite grid matches legacy diff viewer minimum page size. */
const SPRITE_DIFF_MIN_PER_PAGE = 115;

function asFiniteNumArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
}

function asIntRevMap(v: unknown): Record<number, number> {
  if (!v || typeof v !== "object") return {};
  const out: Record<number, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const id = Number.parseInt(k, 10);
    if (!Number.isFinite(id)) continue;
    const n = typeof val === "number" ? val : Number(val);
    if (Number.isFinite(n)) out[id] = n;
  }
  return out;
}

function diffSpriteSourceRev(
  kind: SpriteDiffEntry["kind"],
  id: number,
  olderRev: number,
  newerRev: number,
  addedInRev: Record<number, number>,
  changedInRev: Record<number, number>,
): number {
  if (kind === "added") return addedInRev[id] ?? newerRev;
  if (kind === "changed") return changedInRev[id] ?? newerRev;
  return olderRev;
}

type DiffSpritesViewProps = {
  diffViewMode: DiffMode;
  /** Numeric revision for combined (full) sprite list and thumbnails. */
  combinedRev: number;
  baseRev: number;
  rev: number;
  /**
   * When set (Diff explorer), open the shared center PNG viewer instead of a local modal.
   */
  onOpenSprite?: (id: number, kind: SpriteDiffEntry["kind"]) => void;
  /** Hide search / download toolbar (repository sidebar owns them). */
  hideSearchChrome?: boolean;
  /** Shared search with the repository sidebar (filters the grid/table). */
  controlledSearch?: {
    mode: DiffSearchFieldMode;
    onModeChange: (mode: DiffSearchFieldMode) => void;
    text: string;
    onTextChange: (text: string) => void;
    tags: SearchTag[];
    onTagsChange: (tags: SearchTag[]) => void;
    deltaFilterMode: ConfigFilterMode;
    onDeltaFilterModeChange: (mode: ConfigFilterMode) => void;
  } | null;
};

function normalizeSourceRevById(raw: unknown): Record<number, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number.parseInt(k, 10);
    if (Number.isNaN(id) || typeof v !== "number" || !Number.isFinite(v)) continue;
    out[id] = v;
  }
  return out;
}

function gamevalRevisionForSprites(
  diffViewMode: DiffMode,
  combinedRev: number,
  baseRev: number,
  rev: number,
): number {
  return diffViewMode === "combined" ? combinedRev : Math.max(baseRev, rev);
}

export function DiffSpritesView({
  diffViewMode,
  combinedRev,
  baseRev,
  rev,
  onOpenSprite,
  hideSearchChrome = false,
  controlledSearch = null,
}: DiffSpritesViewProps) {
  const { selectedCacheType } = useCacheType();
  const { settings } = useSettings();
  const { loadGamevalType, hasLoaded, lookupGameval, getGamevalExtra } = useGamevals();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const clearSpriteViewerUrl = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("sprite")) return;
    clearSpriteViewerParams(params);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const [spritePage, setSpritePage] = React.useState(1);
  const [spritePerPage, setSpritePerPage] = React.useState<number>(105);
  const debouncedSpritePage = useDebouncedValue(spritePage, SPRITE_PAGE_DEBOUNCE_MS);
  const spriteGamevalRev = gamevalRevisionForSprites(diffViewMode, combinedRev, baseRev, rev);
  const spriteGamevalSupported = spriteGamevalRev >= GAMEVAL_MIN_REVISION;

  /** All four modes stay visible; these are grayed out (never removed from the menu). */
  const spriteSearchDisabledModes = React.useMemo((): readonly DiffSearchFieldMode[] => {
    const spritesNoNameRegex: DiffSearchFieldMode[] = ["name", "regex"];
    if (!spriteGamevalSupported) return ["gameval", ...spritesNoNameRegex];
    return spritesNoNameRegex;
  }, [spriteGamevalSupported]);

  const spriteSearchModeOptionTitles = React.useMemo(() => {
    const revHint = `Needs revision ${GAMEVAL_MIN_REVISION}+ (current ${spriteGamevalRev}).`;
    const spritesOnly = "Sprites: use ID or Gameval only.";
    if (!spriteGamevalSupported) {
      return { gameval: revHint, name: revHint, regex: revHint } as const;
    }
    return { name: spritesOnly, regex: spritesOnly } as const;
  }, [spriteGamevalSupported, spriteGamevalRev]);

  const [localSpriteSearchMode, setLocalSpriteSearchMode] = React.useState<DiffSearchFieldMode>(() => {
    const gRev = gamevalRevisionForSprites(diffViewMode, combinedRev, baseRev, rev);
    const supported = gRev >= GAMEVAL_MIN_REVISION;
    const disabled: DiffSearchFieldMode[] = supported ? ["name", "regex"] : ["gameval", "name", "regex"];
    return pickDefaultArchiveTableSearchMode(gRev, disabled);
  });
  const [localSpriteSearchText, setLocalSpriteSearchText] = React.useState("");
  const [localSpriteTags, setLocalSpriteTags] = React.useState<SearchTag[]>([]);
  /** Diff mode only: narrow the delta list before ID / gameval / name / regex filters. */
  const [localSpriteDeltaFilterMode, setLocalSpriteDeltaFilterMode] =
    React.useState<ConfigFilterMode>("changed");

  const spriteSearchMode = controlledSearch?.mode ?? localSpriteSearchMode;
  const spriteSearchText = controlledSearch?.text ?? localSpriteSearchText;
  const spriteTags = controlledSearch?.tags ?? localSpriteTags;
  const spriteDeltaFilterMode = controlledSearch?.deltaFilterMode ?? localSpriteDeltaFilterMode;

  const setSpriteSearchMode = React.useCallback(
    (next: DiffSearchFieldMode | ((prev: DiffSearchFieldMode) => DiffSearchFieldMode)) => {
      if (controlledSearch) {
        const resolved = typeof next === "function" ? next(controlledSearch.mode) : next;
        controlledSearch.onModeChange(resolved);
        return;
      }
      setLocalSpriteSearchMode(next);
    },
    [controlledSearch],
  );
  const setSpriteSearchText = React.useCallback(
    (next: string) => {
      if (controlledSearch) {
        controlledSearch.onTextChange(next);
        return;
      }
      setLocalSpriteSearchText(next);
    },
    [controlledSearch],
  );
  const setSpriteTags = React.useCallback(
    (next: SearchTag[] | ((prev: SearchTag[]) => SearchTag[])) => {
      if (controlledSearch) {
        const resolved = typeof next === "function" ? next(controlledSearch.tags) : next;
        controlledSearch.onTagsChange(resolved);
        return;
      }
      setLocalSpriteTags(next);
    },
    [controlledSearch],
  );
  const setSpriteDeltaFilterMode = React.useCallback(
    (next: ConfigFilterMode) => {
      if (controlledSearch) {
        controlledSearch.onDeltaFilterModeChange(next);
        return;
      }
      setLocalSpriteDeltaFilterMode(next);
    },
    [controlledSearch],
  );
  const [spriteFullViewMode, setSpriteFullViewMode] = React.useState<"grid" | "table">("grid");
  /** Diff explorer (and Diff mode) stay grid-only — no Table toggle. */
  const spriteListViewMode: "grid" | "table" =
    hideSearchChrome || diffViewMode === "diff" ? "grid" : spriteFullViewMode;

  const [combinedSpriteIds, setCombinedSpriteIds] = React.useState<number[]>([]);
  const [sourceRevById, setSourceRevById] = React.useState<Record<number, number>>({});
  const [combinedStatus, setCombinedStatus] = React.useState<
    "idle" | "loading" | "ok" | "error" | "decoding"
  >("idle");
  const [combinedError, setCombinedError] = React.useState<string | null>(null);
  /** Combined view: which sprite modal is open (thumbnail + row/cell open the same modal). */
  const [spriteModalId, setSpriteModalId] = React.useState<number | null>(null);

  const [deltaEntries, setDeltaEntries] = React.useState<SpriteDiffEntry[]>([]);
  const [deltaAddedInRev, setDeltaAddedInRev] = React.useState<Record<number, number>>({});
  const [deltaChangedInRev, setDeltaChangedInRev] = React.useState<Record<number, number>>({});
  const [deltaRemovedInRev, setDeltaRemovedInRev] = React.useState<Record<number, number>>({});
  const [deltaStatus, setDeltaStatus] = React.useState<"idle" | "loading" | "ok" | "error" | "decoding">("idle");
  const [deltaError, setDeltaError] = React.useState<string | null>(null);
  const [decodeProgress, setDecodeProgress] = React.useState<DiffDecodeProgress | null>(null);
  const [compare, setCompare] = React.useState<{ id: number; kind: SpriteDiffEntry["kind"] } | null>(null);
  const closingCompareRef = React.useRef(false);

  const combinedRequestRef = React.useRef(0);
  const deltaRequestRef = React.useRef(0);

  /** Cache APIs expect older → newer; UI Base/Compare may be reversed. */
  const spriteDiffApi = React.useMemo(() => diffCacheOrderedPair(baseRev, rev), [baseRev, rev]);
  const spriteOlderRev = spriteDiffApi.base;
  const spriteNewerRev = spriteDiffApi.rev;

  React.useEffect(() => {
    if (diffViewMode !== "combined") {
      setCombinedStatus("idle");
      setDecodeProgress(null);
      return;
    }

    const requestId = ++combinedRequestRef.current;
    const ac = new AbortController();
    setCombinedStatus("loading");
    setCombinedError(null);
    setDecodeProgress(null);

    const run = async () => {
      try {
        const url = combinedSpritesUrl(selectedCacheType, combinedRev, COMBINED_SPRITE_BASE);
        const cacheKey = `diff:combined:sprites:${selectedCacheType.id}:${COMBINED_SPRITE_BASE}:${combinedRev}`;
        const { data: rawData } = await conditionalJsonFetchAwaitingDecode<unknown>(cacheKey, url, {
          cacheType: selectedCacheType,
          signal: ac.signal,
          onProgress: (progress) => {
            if (requestId !== combinedRequestRef.current) return;
            setDecodeProgress(progress);
            setCombinedStatus("decoding");
          },
        });

        const data = rawData as {
          status?: string;
          spriteIds?: unknown;
          sourceRevById?: unknown;
        };

        if (requestId !== combinedRequestRef.current) return;

        if (isDiffDecodePayload(data)) {
          setCombinedSpriteIds([]);
          setSourceRevById({});
          setCombinedStatus("decoding");
          return;
        }

        const rawIds = Array.isArray(data.spriteIds) ? data.spriteIds : [];
        const spriteIds = rawIds.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
        setCombinedSpriteIds(spriteIds);
        setSourceRevById(normalizeSourceRevById(data.sourceRevById));
        setDecodeProgress(null);
        setCombinedStatus("ok");
      } catch (e) {
        if (ac.signal.aborted || requestId !== combinedRequestRef.current) return;
        setCombinedSpriteIds([]);
        setSourceRevById({});
        setDecodeProgress(null);
        setCombinedStatus("error");
        setCombinedError(e instanceof Error ? e.message : "Failed to load sprites");
      }
    };

    void run();
    return () => ac.abort();
  }, [diffViewMode, combinedRev, selectedCacheType]);

  React.useEffect(() => {
    if (diffViewMode === "combined") {
      setDeltaEntries([]);
      setDeltaAddedInRev({});
      setDeltaChangedInRev({});
      setDeltaRemovedInRev({});
      setDeltaStatus("idle");
      setDeltaError(null);
      return;
    }

    if (baseRev === rev) {
      setDeltaEntries([]);
      setDeltaAddedInRev({});
      setDeltaChangedInRev({});
      setDeltaRemovedInRev({});
      setDeltaStatus("ok");
      setDeltaError(null);
      setDecodeProgress(null);
      return;
    }

    const requestId = ++deltaRequestRef.current;
    const ac = new AbortController();
    setDeltaStatus("loading");
    setDeltaError(null);
    setDecodeProgress(null);

    const url = diffDeltaSpritesUrl(selectedCacheType, spriteDiffApi);
    const cacheKey = `diff:delta:sprites:${selectedCacheType.id}:${spriteDiffApi.base}:${spriteDiffApi.rev}`;

    void (async () => {
      try {
        const { data: raw } = await conditionalJsonFetchAwaitingDecode<unknown>(cacheKey, url, {
          cacheType: selectedCacheType,
          signal: ac.signal,
          onProgress: (progress) => {
            if (requestId !== deltaRequestRef.current) return;
            setDecodeProgress(progress);
            setDeltaStatus("decoding");
          },
        });
        if (requestId !== deltaRequestRef.current) return;
        if (isDiffDecodePayload(raw)) {
          setDeltaEntries([]);
          setDeltaStatus("decoding");
          return;
        }
        const o = raw as Record<string, unknown>;
        const added = asFiniteNumArray(o.added);
        const changed = asFiniteNumArray(o.changed);
        const removed = asFiniteNumArray(o.removed);
        const byId = (a: number, b: number) => a - b;
        const entries: SpriteDiffEntry[] = [
          ...[...removed].sort(byId).map((id) => ({ id, kind: "removed" as const })),
          ...[...added].sort(byId).map((id) => ({ id, kind: "added" as const })),
          ...[...changed].sort(byId).map((id) => ({ id, kind: "changed" as const })),
        ];
        setDeltaEntries(entries);
        setDeltaAddedInRev(asIntRevMap(o.addedInRev));
        setDeltaChangedInRev(asIntRevMap(o.changedInRev));
        setDeltaRemovedInRev(asIntRevMap(o.removedInRev));
        setDecodeProgress(null);
        setDeltaStatus("ok");
      } catch (e) {
        if (ac.signal.aborted || requestId !== deltaRequestRef.current) return;
        setDeltaEntries([]);
        setDecodeProgress(null);
        setDeltaStatus("error");
        setDeltaError(e instanceof Error ? e.message : "Failed to load sprite delta");
      }
    })();

    return () => ac.abort();
  }, [diffViewMode, baseRev, rev, selectedCacheType, spriteDiffApi]);

  React.useEffect(() => {
    if (diffViewMode !== "diff") return;
    setSpritePerPage((p) => (p < SPRITE_DIFF_MIN_PER_PAGE ? SPRITE_DIFF_MIN_PER_PAGE : p));
  }, [diffViewMode]);

  const spriteSearchDisabledModesKey = spriteSearchDisabledModes.join("\0");

  React.useEffect(() => {
    if (controlledSearch) return;
    if (spriteGamevalRev >= GAMEVAL_MIN_REVISION) return;
    setSpriteSearchMode("id");
    setSpriteTags([]);
  }, [controlledSearch, setSpriteSearchMode, setSpriteTags, spriteGamevalRev]);

  /** Prefer gameval when Full/Diff or revision support changes which modes exist. */
  React.useEffect(() => {
    if (controlledSearch) return;
    setSpriteSearchMode(pickDefaultArchiveTableSearchMode(spriteGamevalRev, spriteSearchDisabledModes));
    // spriteGamevalRev read for pickDefault; omit from deps so revision-only changes do not reset mode.
  }, [controlledSearch, diffViewMode, setSpriteSearchMode, spriteSearchDisabledModesKey]);

  React.useEffect(() => {
    if (spriteGamevalRev < GAMEVAL_MIN_REVISION) return;
    const q = spriteSearchText.trim();
    const needsLoad =
      (spriteSearchMode === "gameval" && spriteTags.length > 0) ||
      spriteSearchMode === "name" ||
      (spriteSearchMode === "regex" && q.length > 0);
    if (!needsLoad) return;
    void loadGamevalType(SPRITETYPES, spriteGamevalRev);
  }, [spriteGamevalRev, spriteSearchMode, spriteTags.length, spriteSearchText, loadGamevalType]);

  React.useEffect(() => {
    if (diffViewMode !== "combined") setSpriteModalId(null);
  }, [diffViewMode]);

  React.useEffect(() => {
    if (diffViewMode === "combined") setSpriteDeltaFilterMode("all");
    else setSpriteDeltaFilterMode("changed");
  }, [diffViewMode]);

  React.useEffect(() => {
    setSpriteModalId(null);
  }, [combinedRev]);

  const combinedBaseSpriteIds = React.useMemo(() => {
    if (diffViewMode !== "combined") return [];
    return combinedSpriteIds;
  }, [diffViewMode, combinedSpriteIds]);

  const fullSpriteIds = React.useMemo(() => {
    if (diffViewMode !== "combined") return [];

    const query = spriteSearchText.trim();
    const gvReady = spriteGamevalRev >= GAMEVAL_MIN_REVISION && hasLoaded(SPRITETYPES, spriteGamevalRev);

    const needsGamevalData =
      (spriteSearchMode === "gameval" && spriteTags.length > 0) ||
      (spriteSearchMode === "name" && query.length > 0) ||
      (spriteSearchMode === "regex" && query.length > 0);

    if (needsGamevalData && !gvReady) {
      return combinedBaseSpriteIds;
    }

    if (spriteSearchMode === "id" && spriteSearchText.trim().length > 0) {
      return combinedBaseSpriteIds.filter((id) => idQueryMatchesNumericId(id, spriteSearchText));
    }

    if (
      spriteSearchMode === "gameval" &&
      spriteTags.length === 0 &&
      spriteSearchText.trim().length > 0 &&
      looksLikeSpriteIdQueryText(spriteSearchText)
    ) {
      return combinedBaseSpriteIds.filter((id) => idQueryMatchesNumericId(id, spriteSearchText));
    }

    if (spriteSearchMode === "gameval" && spriteTags.length > 0) {
      const tagFiltered = combinedBaseSpriteIds.filter((id) =>
        matchesSpriteGamevalTags(SPRITETYPES, id, spriteTags, spriteGamevalRev, { lookupGameval, getGamevalExtra }),
      );
      if (spriteSearchText.trim() && looksLikeSpriteIdQueryText(spriteSearchText)) {
        return tagFiltered.filter((id) => idQueryMatchesNumericId(id, spriteSearchText));
      }
      return tagFiltered;
    }

    if (spriteSearchMode === "name" && query.length > 0) {
      return combinedBaseSpriteIds.filter((id) =>
        spriteMatchesSubstringName(SPRITETYPES, id, query, spriteGamevalRev, { lookupGameval, getGamevalExtra }),
      );
    }

    if (spriteSearchMode === "regex" && query.length > 0) {
      return combinedBaseSpriteIds.filter((id) =>
        spriteMatchesRegex(SPRITETYPES, id, query, spriteGamevalRev, { lookupGameval, getGamevalExtra }),
      );
    }

    return combinedBaseSpriteIds;
  }, [
    diffViewMode,
    combinedBaseSpriteIds,
    spriteSearchMode,
    spriteSearchText,
    spriteTags,
    spriteGamevalRev,
    hasLoaded,
    lookupGameval,
    getGamevalExtra,
  ]);

  const filteredDiffSprites = React.useMemo(() => {
    const kindFiltered =
      spriteDeltaFilterMode === "all"
        ? deltaEntries
        : deltaEntries.filter((e) => e.kind === spriteDeltaFilterMode);
    const base = kindFiltered;
    const query = spriteSearchText.trim();
    const gvReady = spriteGamevalRev >= GAMEVAL_MIN_REVISION && hasLoaded(SPRITETYPES, spriteGamevalRev);

    const needsGamevalData =
      (spriteSearchMode === "gameval" && spriteTags.length > 0) ||
      (spriteSearchMode === "name" && query.length > 0) ||
      (spriteSearchMode === "regex" && query.length > 0);

    if (needsGamevalData && !gvReady) {
      return base;
    }

    if (spriteSearchMode === "id" && spriteSearchText.trim().length > 0) {
      return base.filter((s) => idQueryMatchesNumericId(s.id, spriteSearchText));
    }

    if (
      spriteSearchMode === "gameval" &&
      spriteTags.length === 0 &&
      spriteSearchText.trim().length > 0 &&
      looksLikeSpriteIdQueryText(spriteSearchText)
    ) {
      return base.filter((s) => idQueryMatchesNumericId(s.id, spriteSearchText));
    }

    if (spriteSearchMode === "gameval" && spriteTags.length > 0) {
      const tagFiltered = base.filter((s) =>
        matchesSpriteGamevalTags(SPRITETYPES, s.id, spriteTags, spriteGamevalRev, { lookupGameval, getGamevalExtra }),
      );
      if (spriteSearchText.trim() && looksLikeSpriteIdQueryText(spriteSearchText)) {
        return tagFiltered.filter((s) => idQueryMatchesNumericId(s.id, spriteSearchText));
      }
      return tagFiltered;
    }

    if (spriteSearchMode === "name" && query.length > 0) {
      return base.filter((s) =>
        spriteMatchesSubstringName(SPRITETYPES, s.id, query, spriteGamevalRev, { lookupGameval, getGamevalExtra }),
      );
    }

    if (spriteSearchMode === "regex" && query.length > 0) {
      return base.filter((s) =>
        spriteMatchesRegex(SPRITETYPES, s.id, query, spriteGamevalRev, { lookupGameval, getGamevalExtra }),
      );
    }

    return base;
  }, [
    deltaEntries,
    spriteDeltaFilterMode,
    spriteSearchMode,
    spriteSearchText,
    spriteTags,
    spriteGamevalRev,
    hasLoaded,
    lookupGameval,
    getGamevalExtra,
  ]);

  const listForPaging = diffViewMode === "combined" ? fullSpriteIds : filteredDiffSprites;
  const totalCount = listForPaging.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / spritePerPage));
  /** Page used for the thumbnail slice (debounced so rapid paging does not mount every intermediate page). */
  const dataPage = Math.min(Math.max(1, debouncedSpritePage), totalPages);
  /** Page reflected in the pagination bar (immediate intent). */
  const pendingPage = Math.min(Math.max(1, spritePage), totalPages);
  const pageStart = (dataPage - 1) * spritePerPage;
  const pagedRows = listForPaging.slice(pageStart, pageStart + spritePerPage);

  React.useEffect(() => {
    setSpritePage(1);
  }, [
    diffViewMode,
    spritePerPage,
    spriteDeltaFilterMode,
    spriteSearchMode,
    spriteSearchText,
    spriteTags,
    combinedRev,
    baseRev,
    rev,
  ]);

  const spritePageSizeOptions = React.useMemo(
    () =>
      diffViewMode === "diff"
        ? SPRITE_PER_PAGE_OPTIONS.filter((n) => n >= SPRITE_DIFF_MIN_PER_PAGE)
        : [...SPRITE_PER_PAGE_OPTIONS],
    [diffViewMode],
  );

  const openSpriteCompare = React.useCallback(
    (id: number, kind: SpriteDiffEntry["kind"]) => {
      if (onOpenSprite) {
        onOpenSprite(id, kind);
        return;
      }
      if (closingCompareRef.current) return;
      setCompare({ id, kind });
    },
    [onOpenSprite],
  );

  const openSpriteModal = React.useCallback(
    (id: number) => {
      if (onOpenSprite) {
        onOpenSprite(id, "changed");
        return;
      }
      setSpriteModalId(id);
    },
    [onOpenSprite],
  );

  const onCompareDialogOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        closingCompareRef.current = true;
        setCompare(null);
        clearSpriteViewerUrl();
        window.setTimeout(() => {
          closingCompareRef.current = false;
        }, 150);
      }
    },
    [clearSpriteViewerUrl],
  );

  /** Workbench / modal path: restore open sprite from a shared URL. */
  React.useEffect(() => {
    if (onOpenSprite) return;
    const parsed = parseSpriteViewerUrlState(searchParams);
    if (parsed.spriteId == null) return;
    if (diffViewMode === "diff") {
      const entry = deltaEntries.find((e) => e.id === parsed.spriteId);
      setCompare({
        id: parsed.spriteId,
        kind: parsed.kind ?? entry?.kind ?? "changed",
      });
      return;
    }
    setSpriteModalId(parsed.spriteId);
  }, [deltaEntries, diffViewMode, onOpenSprite, searchParams]);

  const titleCount = diffViewMode === "combined" ? fullSpriteIds.length : filteredDiffSprites.length;

  const showGamevalPending =
    spriteGamevalRev >= GAMEVAL_MIN_REVISION &&
    ((spriteSearchMode === "gameval" && spriteTags.length > 0) ||
      spriteSearchMode === "name" ||
      (spriteSearchMode === "regex" && spriteSearchText.trim().length > 0)) &&
    !hasLoaded(SPRITETYPES, spriteGamevalRev);

  const showGamevalRevHint =
    spriteSearchMode === "gameval" &&
    spriteTags.length > 0 &&
    spriteGamevalRev < GAMEVAL_MIN_REVISION;

  return (
    <>
      <DiffSectionHeader
        title={diffViewMode === "combined" ? "Sprites" : `Sprite changes (Base ${baseRev} → Compare ${rev})`}
        tooltipContent={diffSearchModeTooltipHelp(spriteSearchMode)}
        countLabel={`· ${titleCount.toLocaleString()} sprite${titleCount !== 1 ? "s" : ""}`}
        trailing={
          diffViewMode === "combined" && !hideSearchChrome ? (
            <DiffViewModeToggle
              value={spriteFullViewMode}
              onChange={setSpriteFullViewMode}
              options={[
                { value: "grid", label: "Grid" },
                { value: "table", label: "Table" },
              ]}
            />
          ) : null
        }
      />

      {diffViewMode === "combined" && combinedStatus === "error" && combinedError ? (
        <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {combinedError}
        </p>
      ) : null}
      {diffViewMode === "combined" && combinedStatus === "decoding" ? (
        <div className="mb-3">
          <DiffDecodeProgressBanner
            progress={decodeProgress}
            fallbackMessage="Sprite index is decoding on the cache server…"
          />
        </div>
      ) : null}
      {showGamevalPending ? (
        <div className="mb-3" aria-busy="true" aria-label="Loading gameval data">
          <Skeleton className="h-4 w-56 max-w-full" delayMs={0} shimmer={false} />
        </div>
      ) : null}
      {showGamevalRevHint ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Gameval-based sprite filters need revision {GAMEVAL_MIN_REVISION} or newer (current{" "}
          {spriteGamevalRev}).
        </p>
      ) : null}

      {!hideSearchChrome ? (
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-2 justify-between">
        <div className={cn(DIFF_COMBINED_SEARCH_WRAP_CLASS, "!mb-0")}>
          <DiffUnifiedSearchField
            size="large"
            mode={spriteSearchMode}
            onModeChange={setSpriteSearchMode}
            disabledModes={spriteSearchDisabledModes}
            modeOptionTitles={spriteSearchModeOptionTitles}
            tagModes={["gameval"]}
            value={spriteSearchText}
            onChange={(e) => setSpriteSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && spriteSearchMode === "gameval" && spriteSearchText.trim()) {
                e.preventDefault();
                setSpriteTags((prev) => [...prev, { value: spriteSearchText.trim(), exact: false }]);
                setSpriteSearchText("");
              }
            }}
            tags={spriteTags}
            onTagToggle={(idx) =>
              setSpriteTags((prev) => prev.map((t, i) => (i === idx ? { ...t, exact: !t.exact } : t)))
            }
            onTagRemove={(idx) => setSpriteTags((prev) => prev.filter((_, i) => i !== idx))}
            onClearTags={() => setSpriteTags([])}
            gamevalAutocomplete={{
              type: SPRITETYPES,
              rev: spriteGamevalRev,
              enabled: spriteGamevalSupported && settings.suggestionDisplay.sprites,
            }}
          />
        </div>
        {diffViewMode === "diff" ? (
          <OptionDropdown
            className="w-[8.5rem] shrink-0"
            ariaLabel="Sprite change type filter"
            value={spriteDeltaFilterMode}
            options={[
              { value: "all", label: "All" },
              { value: "added", label: "Added" },
              { value: "changed", label: "Changed" },
              { value: "removed", label: "Removed" },
            ]}
            onChange={(v) => setSpriteDeltaFilterMode(v as ConfigFilterMode)}
          />
        ) : null}
        <ZipArchiveDownloadButton
          kind="sprites"
          diffViewMode={diffViewMode}
          combinedRev={combinedRev}
          baseRev={baseRev}
          rev={rev}
          tableBase={COMBINED_SPRITE_BASE}
        />
      </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {diffViewMode === "combined" && combinedStatus === "loading" ? (
          spriteListViewMode === "grid" ? (
            <div
              className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(80px,1fr))] content-start gap-2 overflow-auto"
              aria-busy="true"
              aria-label="Loading sprite list"
            >
              {Array.from({ length: COMBINED_GRID_SKELETON_CELLS }, (_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 rounded border border-border/50 bg-muted/15 p-1"
                >
                  <Skeleton className="h-16 w-full rounded-sm" delayMs={i * 26} />
                  <Skeleton className="h-3 w-9 rounded-sm" delayMs={i * 26 + 35} shimmer={false} />
                </div>
              ))}
            </div>
          ) : (
            <DiffArchiveTable aria-busy="true" aria-label="Loading sprite list">
              <colgroup>
                <col className="w-20" />
                <col className="w-14" />
                {spriteGamevalSupported ? <col /> : null}
              </colgroup>
              <TableHeader className={DIFF_ARCHIVE_TABLE_HEADER_CLASS}>
                <TableRow>
                  <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>ID</TableHead>
                  <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Preview</TableHead>
                  {spriteGamevalSupported ? (
                    <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Gameval</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: spritePerPage }, (_, i) => (
                  <TableRow key={`spr-sk-${i}`} className="border-t align-top hover:bg-transparent">
                    <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                      <Skeleton className="h-4 w-10" delayMs={Math.min(i, 24) * 18} shimmer={false} />
                    </TableCell>
                    <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                      <Skeleton className="h-10 w-10 rounded-md" delayMs={Math.min(i, 24) * 18 + 12} />
                    </TableCell>
                    {spriteGamevalSupported ? (
                      <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                        <Skeleton className="h-4 w-40 max-w-full" delayMs={Math.min(i, 24) * 18 + 24} shimmer={false} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </DiffArchiveTable>
          )
        ) : diffViewMode === "combined" ? (
          spriteListViewMode === "grid" ? (
            <div
              className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(80px,1fr))] content-start gap-2 overflow-auto"
              aria-busy={pendingPage !== dataPage}
            >
              {combinedStatus === "ok" && combinedBaseSpriteIds.length === 0 ? (
                <div className="col-span-full flex min-h-[8rem] items-center justify-center text-sm text-muted-foreground">
                  No sprites in the combined index for this revision.
                </div>
              ) : null}
              {(pagedRows as number[]).map((id) => {
                const source = sourceRevById[id] ?? combinedRev;
                const src = diffSpriteImageUrl(selectedCacheType,id, {
                  base: COMBINED_SPRITE_BASE,
                  rev: combinedRev,
                  source,
                });
                const gv = spriteGamevalSupported ? lookupGameval(SPRITETYPES, id, combinedRev) : null;
                return (
                  <LazyWhenVisible
                    key={id}
                    className="min-h-[5.5rem] w-full min-w-0 rounded-[inherit]"
                    fallback={
                      <div
                        className="flex min-h-[5.5rem] w-full flex-col overflow-hidden rounded border border-border/50 bg-muted/20 p-1"
                        aria-hidden
                      >
                        <div className="min-h-[4rem] w-full flex-1 rounded-sm bg-muted/30" />
                        <div className="mx-auto mt-1 h-3 w-10 rounded-sm bg-muted/40" />
                      </div>
                    }
                  >
                    <CombinedSpriteGridTile
                      id={id}
                      combinedRev={combinedRev}
                      imageUrl={src}
                      gamevalName={gv}
                      onOpen={openSpriteModal}
                    />
                  </LazyWhenVisible>
                );
              })}
            </div>
          ) : (
            <DiffArchiveTable aria-busy={pendingPage !== dataPage}>
              <colgroup>
                <col className="w-20" />
                <col className="w-14" />
                {spriteGamevalSupported ? <col /> : null}
              </colgroup>
              <TableHeader className={DIFF_ARCHIVE_TABLE_HEADER_CLASS}>
                <TableRow>
                  <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>ID</TableHead>
                  <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Preview</TableHead>
                  {spriteGamevalSupported ? (
                    <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Gameval</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedStatus === "ok" && combinedBaseSpriteIds.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={spriteGamevalSupported ? 3 : 2}
                      className="p-4 text-center text-muted-foreground"
                    >
                      No sprites in the combined index for this revision.
                    </TableCell>
                  </TableRow>
                ) : null}
                {(pagedRows as number[]).map((id) => {
                  const source = sourceRevById[id] ?? combinedRev;
                  const src = diffSpriteImageUrl(selectedCacheType,id, {
                    base: COMBINED_SPRITE_BASE,
                    rev: combinedRev,
                    source,
                  });
                  const gamevalName = spriteGamevalSupported
                    ? lookupGameval(SPRITETYPES, id, combinedRev)
                    : null;
                  return (
                    <CombinedSpriteTableRow
                      key={id}
                      id={id}
                      combinedRev={combinedRev}
                      imageUrl={src}
                      gamevalName={gamevalName}
                      showGamevalCol={spriteGamevalSupported}
                      onOpen={openSpriteModal}
                    />
                  );
                })}
              </TableBody>
            </DiffArchiveTable>
          )
        ) : baseRev === rev ? (
          <p className="text-sm text-muted-foreground">
            Select different Base and Compare revisions to see sprite changes.
          </p>
        ) : deltaStatus === "loading" ? (
          <div
            className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(80px,1fr))] content-start gap-2 overflow-auto"
            aria-busy="true"
            aria-label="Loading sprite changes"
          >
            {Array.from({ length: 18 }, (_, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1 rounded border border-border/50 bg-muted/15 p-1"
              >
                <Skeleton className="h-16 w-full rounded-sm" delayMs={i * 22} />
                <Skeleton className="h-3 w-9 rounded-sm" delayMs={i * 22 + 30} shimmer={false} />
              </div>
            ))}
          </div>
        ) : deltaStatus === "decoding" ? (
          <DiffDecodeProgressBanner
            progress={decodeProgress}
            fallbackMessage="Sprite delta is decoding on the cache server…"
          />
        ) : deltaStatus === "error" && deltaError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {deltaError}
          </p>
        ) : deltaEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sprite changes between these revisions.</p>
        ) : filteredDiffSprites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sprites match the current filters (change type or search). Try &quot;All&quot; or clear the search.
          </p>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(80px,1fr))] content-start gap-2 overflow-auto">
            {(pagedRows as SpriteDiffEntry[]).map((entry) => {
              const source = diffSpriteSourceRev(
                entry.kind,
                entry.id,
                spriteOlderRev,
                spriteNewerRev,
                deltaAddedInRev,
                deltaChangedInRev,
              );
              const src = diffSpriteImageUrl(selectedCacheType,entry.id, { ...spriteDiffApi, source });
              const gv = spriteGamevalSupported ? lookupGameval(SPRITETYPES, entry.id, source) : null;
              const tipAdded = deltaAddedInRev[entry.id] ?? spriteNewerRev;
              const tipChanged = deltaChangedInRev[entry.id] ?? spriteNewerRev;
              const tipRemoved = deltaRemovedInRev[entry.id] ?? spriteNewerRev;

              return (
                <Tooltip key={`${entry.kind}-${entry.id}`}>
                  <TooltipTrigger>
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "relative flex min-h-[5.5rem] w-full cursor-pointer flex-col overflow-hidden rounded border border-border bg-muted/30 p-1 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        entry.kind === "added" && "border-green-600/50",
                        entry.kind === "changed" && "border-amber-600/50",
                        entry.kind === "removed" && "border-red-600/50",
                      )}
                      onClick={() => openSpriteCompare(entry.id, entry.kind)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openSpriteCompare(entry.id, entry.kind);
                        }
                      }}
                    >
                      <LazyWhenVisible
                        className="relative min-h-[4rem] w-full flex-1 rounded-sm"
                        fallback={<div className="absolute inset-0 rounded-sm bg-muted/35" aria-hidden />}
                      >
                        <RSSprite
                          id={entry.id}
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
                          gameval={gv ?? undefined}
                          gamevalRevision={source}
                          imageUrl={src}
                          fullSizeImageUrl={src}
                        />
                      </LazyWhenVisible>
                      <span className="relative z-10 mt-0.5 w-full shrink-0 px-1 text-center text-xs text-muted-foreground">
                        {entry.id}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="max-w-none border border-zinc-800 bg-zinc-950 p-3 text-white"
                  >
                    {entry.kind === "added" ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-medium">Added in rev {tipAdded}</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={diffSpriteImageUrl(selectedCacheType,entry.id, {
                            ...spriteDiffApi,
                            source: tipAdded,
                          })}
                          alt=""
                          width={96}
                          height={96}
                          className="max-h-24 w-auto rounded border object-contain"
                          style={{ imageRendering: "pixelated" }}
                          decoding="async"
                        />
                      </div>
                    ) : entry.kind === "changed" ? (
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-medium">Before ({spriteOlderRev})</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={diffSpriteImageUrl(selectedCacheType,entry.id, { ...spriteDiffApi, source: spriteOlderRev })}
                            alt=""
                            className="max-h-24 w-auto rounded border bg-muted/50 object-contain"
                            style={{ imageRendering: "pixelated" }}
                            decoding="async"
                          />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-medium">After ({tipChanged})</span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={diffSpriteImageUrl(selectedCacheType,entry.id, { ...spriteDiffApi, source: tipChanged })}
                            alt=""
                            className="max-h-24 w-auto rounded border bg-muted/50 object-contain"
                            style={{ imageRendering: "pixelated" }}
                            decoding="async"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-medium">
                          Removed in rev {tipRemoved} (was in {spriteOlderRev})
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={diffSpriteImageUrl(selectedCacheType,entry.id, { ...spriteDiffApi, source: spriteOlderRev })}
                          alt=""
                          className="max-h-24 w-auto rounded border object-contain"
                          style={{ imageRendering: "pixelated" }}
                          decoding="async"
                        />
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}

        {diffViewMode === "combined" && spriteModalId != null ? (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) {
                setSpriteModalId(null);
                clearSpriteViewerUrl();
              }
            }}
          >
            <DialogContent
              className="flex h-[min(90vh,52rem)] w-full max-w-[min(100%,72rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-[min(100%,72rem)]"
              showCloseButton
            >
              <DialogTitle className="sr-only">Sprite {spriteModalId}</DialogTitle>
              <DiffSpritePngViewer
                spriteId={spriteModalId}
                kind="changed"
                diffViewMode="combined"
                combinedRev={combinedRev}
                baseRev={1}
                rev={combinedRev}
                showBack={false}
                className="min-h-0"
              />
            </DialogContent>
          </Dialog>
        ) : null}

        <TablePaginationBar
          pageSize={spritePerPage}
          pageSizeOptions={spritePageSizeOptions}
          onPageSizeChange={(n) => {
            const next = diffViewMode === "diff" ? Math.max(SPRITE_DIFF_MIN_PER_PAGE, n) : n;
            setSpritePerPage(next);
            setSpritePage(1);
          }}
          currentPage={pendingPage}
          totalPages={totalPages}
          onPageChange={setSpritePage}
          showingCount={pagedRows.length}
          totalCount={totalCount}
          countLabel="sprites"
        />
      </div>

      <Dialog open={compare != null} onOpenChange={onCompareDialogOpenChange}>
        <DialogContent
          className="flex h-[min(90vh,52rem)] w-full max-w-[min(100%,72rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-[min(100%,72rem)]"
          showCloseButton
        >
          {compare ? (
            <>
              <DialogTitle className="sr-only">Sprite {compare.id} comparison</DialogTitle>
              <DiffSpritePngViewer
                spriteId={compare.id}
                kind={compare.kind}
                diffViewMode="diff"
                combinedRev={combinedRev}
                baseRev={baseRev}
                rev={rev}
                showBack={false}
                className="min-h-0"
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
