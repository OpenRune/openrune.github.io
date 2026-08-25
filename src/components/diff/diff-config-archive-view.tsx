"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePaginationBar } from "@/components/ui/table-pagination-bar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCacheType } from "@/context/cache-type-context";
import type { GamevalType } from "@/context/gameval-context";
import { useGamevals } from "@/context/gameval-context";
import { useSettings, type AppSettings } from "@/context/settings-context";
import {
  cacheDataUrl,
  combinedSpritesUrl,
  diffCacheOrderedPair,
  diffConfigContentUrl,
  diffConfigTableAllUrl,
  diffConfigTableUrl,
} from "@/lib/cache-api-client";
import { DiffDecodeProgressBanner } from "@/components/diff/diff-decode-progress";
import {
  conditionalJsonFetchAwaitingDecode,
  type DiffDecodeProgress,
} from "@/lib/diff-decode";
import { getTableSearchIndex, putTableSearchIndex } from "@/lib/openrune-idb-cache";
import { cn } from "@/lib/utils";
import { getConfigBlocks, trimBlockEndExclusive, type ConfigSectionBlock } from "@/lib/diff-config-blocks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ChevronDown, Loader2 } from "lucide-react";

import {
  DIFF_COMBINED_SEARCH_WRAP_CLASS,
  GAMEVAL_MIN_REVISION,
  normalizeConfigTypeForCacheApi,
  normalizeSectionIdFromApiType,
  sectionGamevalTypeForSection,
  TEXTURE_PER_PAGE_OPTIONS,
} from "./diff-constants";
import { matchesSpriteGamevalTags, spriteMatchesSubstringName } from "./diff-sprite-gameval-filter";
import { idQueryMatchesNumericId, looksLikeSpriteIdQueryText } from "./diff-id-search";
import {
  buildConfigArchiveTableSearchIndex,
  searchConfigArchiveTableIndexPage,
  type ConfigArchiveTableSearchIndex,
} from "./diff-config-table-search-index";
import type {
  ConfigArchiveTableRow,
  DiffConfigArchiveTextLineProps,
  DiffConfigArchiveViewProps,
} from "./diff-config-archive-types";
import { DiffArchiveTable } from "./diff-archive-table";
import { diffSearchModeTooltipHelp, pickDefaultArchiveTableSearchMode } from "./diff-search-modes";
import { DiffSectionHeader } from "./diff-section-header";
import { DiffUnifiedSearchField } from "./diff-unified-search-field";
import { DiffViewModeToggle } from "./diff-view-mode-toggle";
import {
  DIFF_ARCHIVE_TABLE_CELL_CLASS,
  DIFF_ARCHIVE_TABLE_HEAD_CLASS,
  DIFF_ARCHIVE_TABLE_HEADER_CLASS,
} from "./diff-table-archive-styles";
import { configLinesFromCachePayload, configLinesFromContentPayload, relabelConfigSectionHeaders } from "./diff-config-content";
import { useDiffExplorerFocus } from "./diff-explorer-focus";
import {
  buildSectionMetas,
  buildTextViewRowsWithHeaders,
  DiffChangeMinimap,
  SectionChromeHeader,
  sectionMatchesFocus,
  type TextViewRow,
} from "./diff-section-sticky";
import {
  buildSectionTitleHoverByLineIndex,
  DumpSectionTitleHover,
  type SectionTitleHoverInfo,
} from "./diff-section-title-tooltip";
import { findConfigFocusLineIndex, parseFocusEntityId, bareFocusTitle } from "./diff-focus-match";
import {
  buildPrefixOffsets,
  estimateCharsPerLine,
  estimateWrappedRowUnits,
  virtualWindowFromOffsets,
} from "./diff-text-wrap";
import { useDiffTextLayoutOptional } from "./diff-text-layout";
import { lineMatchesTextQuery, queryHighlightNeedles } from "./diff-text-query-match";
import type { ConfigLine, DiffSearchFieldMode, SearchTag } from "./diff-types";

const DEFAULT_BULK_PAGE = 500;
const DEFAULT_TEXT_OVERSCAN = 14;
const DEFAULT_FIND_DEBOUNCE_MS = 100;
const TABLE_PAGE_CACHE_LIMIT = 96;

type TablePageCacheEntry = {
  rows: ConfigArchiveTableRow[];
  total: number;
  status: "ok" | "decoding";
};

function configTypeToHeaderGamevalType(configType: string): GamevalType | null {
  return sectionGamevalTypeForSection(normalizeSectionIdFromApiType(configType));
}

function parseConfigTablePayload(data: Record<string, unknown>): {
  rows: ConfigArchiveTableRow[];
  total: number;
  decoding: boolean;
} {
  const valueToEntryString = (value: unknown): string => {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return `[${value.map((v) => valueToEntryString(v)).join(", ")}]`;
    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(o, "ref") && o.ref && typeof o.ref === "object") {
        const r = o.ref as Record<string, unknown>;
        const group = typeof r.group === "string" ? r.group : null;
        const name = typeof r.name === "string" ? r.name : null;
        if (group && name) return `${group}.${name}`;
        if (name) return name;
      }
      if (Object.prototype.hasOwnProperty.call(o, "value")) {
        return valueToEntryString(o.value);
      }
      try {
        return JSON.stringify(o);
      } catch {
        return "";
      }
    }
    return String(value);
  };

  if (data.status === "decoding" || data.status === "missing") {
    return { rows: [], total: 0, decoding: true };
  }
  const rawRows = Array.isArray(data.rows) ? data.rows : [];
  const rows: ConfigArchiveTableRow[] = rawRows
    .filter(
      (r): r is ConfigArchiveTableRow =>
        Boolean(r) && typeof r === "object" && typeof (r as ConfigArchiveTableRow).id === "number",
    )
    .map((r) => ({
      id: (r as ConfigArchiveTableRow).id,
      sectionId: (r as ConfigArchiveTableRow).sectionId,
      entries: (() => {
        const source =
          (r as { entries?: unknown }).entries && typeof (r as { entries?: unknown }).entries === "object"
            ? ((r as { entries?: Record<string, unknown> }).entries ?? {})
            : (r as { fields?: unknown }).fields && typeof (r as { fields?: unknown }).fields === "object"
              ? ((r as { fields?: Record<string, unknown> }).fields ?? {})
              : {};
        return Object.entries(source).reduce<Record<string, string>>((acc, [k, v]) => {
          acc[k] = valueToEntryString(v);
          return acc;
        }, {});
      })(),
      entriesRaw: (() => {
        if ((r as { entries?: unknown }).entries && typeof (r as { entries?: unknown }).entries === "object") {
          return { ...((r as { entries?: Record<string, unknown> }).entries ?? {}) };
        }
        if ((r as { fields?: unknown }).fields && typeof (r as { fields?: unknown }).fields === "object") {
          return { ...((r as { fields?: Record<string, unknown> }).fields ?? {}) };
        }
        return {};
      })(),
    }));
  const totalRaw = data.total;
  const total =
    typeof totalRaw === "number" && Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : rows.length;
  return { rows, total, decoding: false };
}

function archiveRowEntryStringsIncludeQuery(row: ConfigArchiveTableRow, queryLower: string): boolean {
  if (!queryLower) return true;
  for (const v of Object.values(row.entries)) {
    if (String(v).toLowerCase().includes(queryLower)) return true;
  }
  return false;
}

function withFieldPrefixIfMissing(before: string | undefined, after: string): string | undefined {
  if (before == null) return before;
  if (!after.includes("=") || before.includes("=")) return before;

  const paramMatch = /^param=parm_\d+=/.exec(after);
  if (paramMatch) return `${paramMatch[0]}${before}`;

  const eq = after.indexOf("=");
  if (eq <= 0) return before;
  return `${after.slice(0, eq + 1)}${before}`;
}

function isBracketSectionTitleLine(lines: ConfigLine[], i: number): boolean {
  if (i <= 0) return false;
  const line = lines[i]?.line ?? "";
  if (!line.startsWith("[") || !line.endsWith("]")) return false;
  return (lines[i - 1]?.line ?? "").startsWith("// ");
}

const ConfigArchiveVirtualTextRow = React.memo(function ConfigArchiveVirtualTextRow({
  line,
  lineType,
  hoverText,
  sectionHover,
  definitionLabel,
  addedInRev,
  changedInRev,
  removedInRev,
  before,
  layout,
  rowH,
  wordWrap,
  combinedRev,
  lookupRevisions,
  debouncedFindQuery,
  findKind,
  findMarkActive,
  TextLine,
  getTextLineShowInline,
  settings,
}: {
  line: string;
  lineType: ConfigLine["type"];
  hoverText?: string;
  sectionHover?: SectionTitleHoverInfo | null;
  definitionLabel?: string;
  addedInRev?: number;
  changedInRev?: number;
  removedInRev?: number;
  before?: string;
  layout: "unified" | "split";
  rowH: number;
  wordWrap?: boolean;
  combinedRev: number;
  lookupRevisions?: readonly number[];
  debouncedFindQuery: string;
  findKind: "literal" | "regex";
  findMarkActive: boolean;
  TextLine: React.ComponentType<DiffConfigArchiveTextLineProps>;
  getTextLineShowInline?: (s: AppSettings) => boolean;
  settings: AppSettings;
}) {
  const beforeDisplay = withFieldPrefixIfMissing(before, line);
  const paintType: ConfigLine["type"] =
    lineType === "change" && beforeDisplay != null && beforeDisplay.trim() === line.trim()
      ? "context"
      : lineType;

  const rowTint =
    paintType === "add"
      ? "bg-green-500/8 dark:bg-green-500/12"
      : paintType === "removed"
        ? "bg-red-500/8 dark:bg-red-500/12"
        : paintType === "change"
          ? "bg-amber-500/10 dark:bg-amber-500/14"
          : "";

  const barColor =
    paintType === "add"
      ? "bg-green-500"
      : paintType === "change"
        ? "bg-amber-500"
        : paintType === "removed"
          ? "bg-red-500"
          : "bg-transparent";

  const hasRefHover = Boolean(hoverText?.trim());
  const isSectionTitle = Boolean(sectionHover);

  const sectionTitleNode = sectionHover ? (
    <span className="font-mono text-xs leading-[22px]">
      <span className="text-sky-500 dark:text-sky-400">[</span>
      <DumpSectionTitleHover info={sectionHover} definitionLabel={definitionLabel} />
      <span className="text-sky-500 dark:text-sky-400">]</span>
    </span>
  ) : null;

  const diffTooltipBody: React.ReactNode =
    paintType === "add" && addedInRev != null
      ? <>Added in rev {addedInRev}</>
      : paintType === "removed" && removedInRev != null
        ? <>Removed in rev {removedInRev}</>
        : paintType === "change" && (changedInRev != null || beforeDisplay != null)
          ? (
            <span className="block space-y-1">
              {changedInRev != null ? <span className="block">Changed in rev {changedInRev}</span> : null}
              {beforeDisplay != null ? (
                <span className="block font-mono text-xs">
                  Before: {beforeDisplay}
                  <br />
                  After: {line}
                </span>
              ) : null}
            </span>
          )
          : null;

  const tooltipBody: React.ReactNode = isSectionTitle ? null : hasRefHover ? hoverText : diffTooltipBody;

  const hostOverflow = wordWrap
    ? "overflow-x-hidden overflow-y-visible"
    : "overflow-x-auto overflow-y-hidden";
  const hostWrap = wordWrap ? "whitespace-pre-wrap break-words [overflow-wrap:anywhere]" : "";

  if (layout === "split") {
    const leftLine = paintType === "add" ? "" : paintType === "change" ? (beforeDisplay ?? before ?? "") : line;
    const rightLine = paintType === "removed" ? "" : line;
    const leftTint =
      paintType === "change"
        ? "bg-amber-500/16 dark:bg-amber-500/14"
        : paintType === "removed"
        ? "bg-red-500/16 dark:bg-red-500/14"
        : "bg-transparent";
    const rightTint =
      paintType === "change"
        ? "bg-amber-500/16 dark:bg-amber-500/14"
        : paintType === "add"
        ? "bg-green-500/16 dark:bg-green-500/14"
        : "bg-transparent";

    return (
      <div className="flex items-stretch" style={{ height: rowH }}>
        <div className="flex min-w-0 flex-1 border-r border-border/30">
          <div
            className={cn(
              "diff-editor-line-host min-h-0 min-w-0 flex-1 px-3 py-0.5 text-xs leading-[22px]",
              hostOverflow,
              hostWrap,
              leftTint,
            )}
          >
            {leftLine ? (
              sectionTitleNode && paintType !== "add" ? (
                sectionTitleNode
              ) : (
                <TextLine
                  line={leftLine}
                  combinedRev={combinedRev}
                  lookupRevisions={lookupRevisions}
                  hoverText={hoverText}
                  showInline={getTextLineShowInline?.(settings)}
                  findKind={findKind}
                  findQuery={debouncedFindQuery}
                  findMarkActive={findMarkActive}
                />
              )
            ) : null}
          </div>
        </div>
        <div className="flex min-w-0 flex-1">
          <div
            className={cn(
              "w-0.5 shrink-0 self-stretch",
              paintType === "add" || paintType === "change" ? "bg-emerald-500/80" : "bg-transparent",
            )}
            aria-hidden
          />
          <div
            className={cn(
              "diff-editor-line-host min-h-0 min-w-0 flex-1 px-3 py-0.5 text-xs leading-[22px]",
              hostOverflow,
              hostWrap,
              rightTint,
            )}
          >
            {rightLine ? (
              sectionTitleNode && paintType !== "removed" ? (
                sectionTitleNode
              ) : (
                <TextLine
                  line={rightLine}
                  combinedRev={combinedRev}
                  lookupRevisions={lookupRevisions}
                  hoverText={hoverText}
                  showInline={getTextLineShowInline?.(settings)}
                  findKind={findKind}
                  findQuery={debouncedFindQuery}
                  findMarkActive={findMarkActive}
                />
              )
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-stretch", rowTint)} style={{ height: rowH }}>
      <div className={cn("w-0.5 shrink-0 self-stretch", barColor)} aria-hidden />
      <div
        className={cn(
          "diff-editor-line-host min-h-0 min-w-0 flex-1 px-3 py-0.5 text-xs leading-[22px]",
          hostOverflow,
          hostWrap,
          paintType === "add" && "bg-green-500/20 dark:bg-green-500/14",
          paintType === "change" && "bg-amber-500/20 dark:bg-amber-500/14",
          paintType === "removed" && "bg-red-500/20 dark:bg-red-500/14",
        )}
      >
        {sectionTitleNode ? (
          sectionTitleNode
        ) : tooltipBody ? (
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <span {...props} className={cn("block w-full min-w-0", props.className)}>
                  <TextLine
                    line={line}
                    combinedRev={combinedRev}
                    lookupRevisions={lookupRevisions}
                    hoverText={hoverText}
                    showInline={getTextLineShowInline?.(settings)}
                    findKind={findKind}
                    findQuery={debouncedFindQuery}
                    findMarkActive={findMarkActive}
                  />
                </span>
              )}
            />
            <TooltipContent
              opaque
              side="right"
              className="max-w-sm whitespace-pre-line border border-zinc-800 bg-zinc-950 p-3 text-xs text-white"
            >
              {tooltipBody}
            </TooltipContent>
          </Tooltip>
        ) : (
          <TextLine
            line={line}
            combinedRev={combinedRev}
            lookupRevisions={lookupRevisions}
            hoverText={hoverText}
            showInline={getTextLineShowInline?.(settings)}
            findKind={findKind}
            findQuery={debouncedFindQuery}
            findMarkActive={findMarkActive}
          />
        )}
      </div>
    </div>
  );
});

export function DiffConfigArchiveView({
  diffViewMode,
  combinedRev,
  baseRev,
  rev,
  textOnly = false,
  configType,
  tableBase = 1,
  title,
  labels,
  tableSearch,
  gamevalAutocomplete,
  gamevalBulkFilter,
  buildTablePlan,
  TextLine,
  textRowHeight,
  getTextLineShowInline,
  textOverscan = DEFAULT_TEXT_OVERSCAN,
  textFindDebounceMs = DEFAULT_FIND_DEBOUNCE_MS,
  searchRowTrailing,
  hideSearchChrome = false,
  controlledSearch = null,
  tableSearchSize = "default",
  tableSearchWrapClassName,
}: DiffConfigArchiveViewProps) {
  const searchParams = useSearchParams();
  const { selectedCacheType } = useCacheType();
  const selectedCacheTypeRef = React.useRef(selectedCacheType);
  selectedCacheTypeRef.current = selectedCacheType;
  const cacheTypeId = selectedCacheType.id;

  const { settings } = useSettings();
  const { loadGamevalType, hasLoaded, lookupGameval, lookupGamevalByName, getGamevalExtra } = useGamevals();
  const isCombined = diffViewMode === "combined";
  const isDiff = diffViewMode === "diff";
  const urlWantsTable = isCombined && searchParams.get("view") === "table";
  const archiveGamevalRev = isCombined ? combinedRev : rev;
  const textLookupRevisions = React.useMemo(() => {
    if (!isDiff) return [archiveGamevalRev] as const;
    const out: number[] = [];
    const pushUnique = (n: number) => {
      if (Number.isFinite(n) && !out.includes(n)) out.push(n);
    };
    // Prefer compare revision first, then base revision for names added/renamed across revisions.
    pushUnique(rev);
    pushUnique(baseRev);
    return out;
  }, [archiveGamevalRev, baseRev, isDiff, rev]);

  const [viewMode, setViewMode] = React.useState<"text" | "table">(() =>
    textOnly || diffViewMode !== "combined" ? "text" : urlWantsTable ? "table" : "text",
  );
  const textLayoutCtx = useDiffTextLayoutOptional();
  const diffLayout = textLayoutCtx?.diffLayout ?? "split";
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState<number>(105);

  const [localTableSearchMode, setLocalTableSearchMode] = React.useState<DiffSearchFieldMode>(() =>
    pickDefaultArchiveTableSearchMode(combinedRev, tableSearch.disabledModes),
  );
  const [localSearchText, setLocalSearchText] = React.useState("");
  const [localGamevalTags, setLocalGamevalTags] = React.useState<SearchTag[]>([]);
  const tableSearchMode = controlledSearch?.mode ?? localTableSearchMode;
  const searchText = controlledSearch?.text ?? localSearchText;
  const gamevalTags = controlledSearch?.tags ?? localGamevalTags;

  const setTableSearchMode = React.useCallback(
    (next: DiffSearchFieldMode | ((prev: DiffSearchFieldMode) => DiffSearchFieldMode)) => {
      if (controlledSearch) {
        const resolved = typeof next === "function" ? next(controlledSearch.mode) : next;
        controlledSearch.onModeChange(resolved);
        return;
      }
      setLocalTableSearchMode(next);
    },
    [controlledSearch],
  );
  const setSearchText = React.useCallback(
    (next: string) => {
      if (controlledSearch) {
        controlledSearch.onTextChange(next);
        return;
      }
      setLocalSearchText(next);
    },
    [controlledSearch],
  );
  const setGamevalTags = React.useCallback(
    (next: SearchTag[] | ((prev: SearchTag[]) => SearchTag[])) => {
      if (controlledSearch) {
        const resolved = typeof next === "function" ? next(controlledSearch.tags) : next;
        controlledSearch.onTagsChange(resolved);
        return;
      }
      setLocalGamevalTags(next);
    },
    [controlledSearch],
  );
  const prevCombinedGamevalSupportedRef = React.useRef(combinedRev >= GAMEVAL_MIN_REVISION);

  const debouncedTableQuery = useDebouncedValue(searchText.trim(), 180);
  const debouncedGamevalTextFragment = useDebouncedValue(searchText.trim(), 180);
  const gamevalApiQuery = React.useMemo(() => {
    const parts: string[] = [];
    for (const t of gamevalTags) {
      parts.push(t.exact ? `"${t.value}"` : t.value);
    }
    if (debouncedGamevalTextFragment) parts.push(debouncedGamevalTextFragment);
    return parts.join(" ").trim();
  }, [gamevalTags, debouncedGamevalTextFragment]);

  // Server-side search handles id/name/regex/gameval and id-range queries now.
  const gamevalClientFilterActive = false;
  const syntaxDrivenClientTableActive = false;

  React.useEffect(() => {
    if (controlledSearch) return;
    const supported = combinedRev >= GAMEVAL_MIN_REVISION;
    const prev = prevCombinedGamevalSupportedRef.current;
    prevCombinedGamevalSupportedRef.current = supported;
    if (!supported) {
      setTableSearchMode((m) => (m === "gameval" ? "id" : m));
      setGamevalTags([]);
      return;
    }
    if (!prev && supported) {
      setTableSearchMode((m) => (m === "id" ? "gameval" : m));
    }
  }, [combinedRev, controlledSearch, setGamevalTags, setTableSearchMode]);

  React.useEffect(() => {
    if (controlledSearch) return;
    if (tableSearchMode !== "gameval") setGamevalTags([]);
  }, [controlledSearch, setGamevalTags, tableSearchMode]);

  React.useEffect(() => {
    if (textOnly || isDiff) {
      setViewMode("text");
    } else if (isCombined) {
      setViewMode(urlWantsTable ? "table" : "text");
    }
  }, [isDiff, isCombined, textOnly, urlWantsTable]);

  const disabledModesKey = tableSearch.disabledModes.join("\0");

  /** When the archive table identity or which modes exist changes, re-apply the default (prefer gameval when allowed). */
  React.useEffect(() => {
    if (controlledSearch) {
      setPage(1);
      return;
    }
    setTableSearchMode(pickDefaultArchiveTableSearchMode(combinedRev, tableSearch.disabledModes));
    setPage(1);
    // combinedRev is read for pickDefault but omitted from deps so changing revision alone does not reset mode.
  }, [configType, controlledSearch, disabledModesKey, setTableSearchMode]);

  React.useEffect(() => {
    if (controlledSearch) return;
    if (!tableSearch.disabledModes.includes(tableSearchMode)) return;
    const next =
      (["gameval", "id", "name", "regex"] as const).find((m) => !tableSearch.disabledModes.includes(m)) ?? "id";
    setTableSearchMode(next);
  }, [controlledSearch, disabledModesKey, setTableSearchMode, tableSearch.disabledModes, tableSearchMode]);

  const [tableRows, setTableRows] = React.useState<ConfigArchiveTableRow[]>([]);
  const [tableTotal, setTableTotal] = React.useState(0);
  const [tableStatus, setTableStatus] = React.useState<"idle" | "loading" | "ok" | "error" | "decoding">("idle");
  const [tableError, setTableError] = React.useState<string | null>(null);
  const tablePageCacheRef = React.useRef(new Map<string, TablePageCacheEntry>());

  const [contentLines, setContentLines] = React.useState<ConfigLine[]>([]);
  const [contentStatus, setContentStatus] = React.useState<
    "idle" | "loading" | "ok" | "error" | "decoding"
  >("idle");
  const [contentError, setContentError] = React.useState<string | null>(null);
  const [decodeProgress, setDecodeProgress] = React.useState<DiffDecodeProgress | null>(null);
  /** Combined text is fetched in entity pages (not one giant /cache dump). */
  const [textFeed, setTextFeed] = React.useState({
    nextOffset: 0,
    total: 0,
    hasMore: false,
    loadingMore: false,
  });
  const textFeedRef = React.useRef(textFeed);
  textFeedRef.current = textFeed;

  const awaitDiffJson = React.useCallback(
    async <T,>(cacheKey: string, url: string) => {
      try {
        const result = await conditionalJsonFetchAwaitingDecode<T>(cacheKey, url, {
          cacheType: selectedCacheType,
          onProgress: setDecodeProgress,
        });
        setDecodeProgress(null);
        return result;
      } catch (e) {
        setDecodeProgress(null);
        throw e;
      }
    },
    [selectedCacheType],
  );

  const [textFindQuery, setTextFindQuery] = React.useState("");
  const debouncedTextFindQuery = useDebouncedValue(textFindQuery, textFindDebounceMs);
  const [textFindActiveIdx, setTextFindActiveIdx] = React.useState(0);
  const { focusBracketTitle, focusNonce } = useDiffExplorerFocus();
  const textScrollRef = React.useRef<HTMLDivElement | null>(null);
  const textVirtRafRef = React.useRef<number | null>(null);
  const textVirtPendingRef = React.useRef({ scrollTop: 0, clientHeight: 400 });
  const [textVirt, setTextVirt] = React.useState({ scrollTop: 0, clientHeight: 400 });
  const [textViewportWidth, setTextViewportWidth] = React.useState(800);
  const wordWrap = settings.editorWordWrap;

  React.useEffect(() => {
    if (!focusNonce || !focusBracketTitle) return;
    setViewMode("text");
    // Prefer bare id for `// 33428`; otherwise use gameval / title text.
    const id = parseFocusEntityId(focusBracketTitle);
    setTextFindQuery(id != null ? String(id) : bareFocusTitle(focusBracketTitle));
    setTextFindActiveIdx(0);
  }, [focusBracketTitle, focusNonce]);

  const onTextScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    textVirtPendingRef.current = { scrollTop: el.scrollTop, clientHeight: el.clientHeight };
    if (textVirtRafRef.current != null) return;
    textVirtRafRef.current = window.requestAnimationFrame(() => {
      textVirtRafRef.current = null;
      const p = textVirtPendingRef.current;
      setTextVirt({ scrollTop: p.scrollTop, clientHeight: p.clientHeight });
      const nearEnd = p.scrollTop + p.clientHeight >= el.scrollHeight - 1600;
      if (nearEnd) void loadMoreCombinedTextRef.current?.();
    });
  }, []);

  React.useEffect(() => {
    return () => {
      if (textVirtRafRef.current != null) {
        window.cancelAnimationFrame(textVirtRafRef.current);
        textVirtRafRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    const el = textScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      const w = el.clientWidth;
      if (w > 0) setTextViewportWidth(w);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode, contentStatus]);

  const [combinedSpriteIds, setCombinedSpriteIds] = React.useState<number[] | null>(null);
  const tableRequestRef = React.useRef(0);
  const gamevalBulkRequestRef = React.useRef(0);
  const syntaxBulkRequestRef = React.useRef(0);
  const contentRequestRef = React.useRef(0);
  const combinedSpritesRequestRef = React.useRef(0);

  const COMBINED_TEXT_PAGE_SIZE = 150;
  const loadMoreCombinedTextRef = React.useRef<(() => Promise<void>) | null>(null);

  const [clientFilteredRows, setClientFilteredRows] = React.useState<ConfigArchiveTableRow[] | null>(null);
  const [clientFetchStatus, setClientFetchStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [clientFetchError, setClientFetchError] = React.useState<string | null>(null);
  const [tableSearchIndex, setTableSearchIndex] = React.useState<ConfigArchiveTableSearchIndex | null>(null);
  const [tableSearchIndexStatus, setTableSearchIndexStatus] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [tableSearchIndexError, setTableSearchIndexError] = React.useState<string | null>(null);

  const bulk = gamevalBulkFilter;
  const gamevalBulkFilterRef = React.useRef(gamevalBulkFilter);
  gamevalBulkFilterRef.current = gamevalBulkFilter;
  const hasGamevalBulkFilter = gamevalBulkFilter != null;

  const gamevalAutocompleteRef = React.useRef(gamevalAutocomplete);
  gamevalAutocompleteRef.current = gamevalAutocomplete;
  const lookupGamevalRef = React.useRef(lookupGameval);
  lookupGamevalRef.current = lookupGameval;
  const getGamevalExtraRef = React.useRef(getGamevalExtra);
  getGamevalExtraRef.current = getGamevalExtra;
  const gamevalAutocompleteType = gamevalAutocomplete?.type ?? null;
  const tableSearchIndexRequestRef = React.useRef(0);
  /** Keys for which a bulk index build has been initiated (latches so in-flight fetches aren't abandoned). */
  const tableSearchIndexRequestedKeysRef = React.useRef(new Set<string>());

  const bulkPageSize = bulk?.bulkPageSize ?? DEFAULT_BULK_PAGE;
  const readyType = bulk?.readyWhenLoaded ?? bulk?.filterGamevalType;
  const gvReadyForBulk =
    Boolean(bulk && combinedRev >= GAMEVAL_MIN_REVISION && readyType && hasLoaded(readyType, combinedRev));

  /** Stable across parent re-renders (inline config objects); avoids refetch flicker on unrelated context updates. */
  const gamevalBulkPreloadFingerprint = React.useMemo(() => {
    if (!gamevalBulkFilter) return "";
    const list = [...(gamevalBulkFilter.preloadTypes ?? [gamevalBulkFilter.filterGamevalType])];
    list.sort();
    return list.join("\0");
  }, [
    gamevalBulkFilter?.filterGamevalType,
    (gamevalBulkFilter?.preloadTypes ?? []).slice().sort().join("\0"),
  ]);

  const gamevalTypesToPreload = React.useMemo(() => {
    const s = new Set<GamevalType>();
    if (gamevalAutocompleteType) s.add(gamevalAutocompleteType);
    for (const t of gamevalBulkPreloadFingerprint.split("\0")) {
      if (t) s.add(t as GamevalType);
    }
    return [...s];
  }, [gamevalAutocompleteType, gamevalBulkPreloadFingerprint]);

  const tableSearchIndexCacheKey = React.useMemo(() => {
    if (!isCombined) return null;
    const bulkKey = gvReadyForBulk && gamevalBulkFilter?.filterGamevalType ? gamevalBulkFilter.filterGamevalType : "base";
    return `diff:config:table-search:${cacheTypeId}:${configType}:${tableBase}:${combinedRev}:${bulkKey}`;
  }, [isCombined, cacheTypeId, configType, tableBase, combinedRev, gvReadyForBulk, gamevalBulkFilter?.filterGamevalType]);

  // Server-side search replaces client-side full-table indexing in combined mode.
  const indexedQueryActive = false;

  // When search becomes active, latch this key so we don't abort a started fetch.
  React.useEffect(() => {
    if (indexedQueryActive && tableSearchIndexCacheKey) {
      tableSearchIndexRequestedKeysRef.current.add(tableSearchIndexCacheKey);
    }
  }, [indexedQueryActive, tableSearchIndexCacheKey]);

  React.useEffect(() => {
    const shouldFetch =
      isCombined &&
      viewMode === "table" &&
      !!tableSearchIndexCacheKey &&
      (indexedQueryActive || tableSearchIndexRequestedKeysRef.current.has(tableSearchIndexCacheKey));

    if (!shouldFetch) {
      setTableSearchIndex(null);
      setTableSearchIndexStatus("idle");
      setTableSearchIndexError(null);
      return;
    }

    const requestId = ++tableSearchIndexRequestRef.current;
    let hydrated = false;
    setTableSearchIndexError(null);

    const run = async () => {
      const cached = await getTableSearchIndex<ConfigArchiveTableSearchIndex>(tableSearchIndexCacheKey);
      if (requestId !== tableSearchIndexRequestRef.current) return;
      if (cached) {
        hydrated = true;
        setTableSearchIndex(cached);
        setTableSearchIndexStatus("ready");
      } else {
        setTableSearchIndex(null);
        setTableSearchIndexStatus("loading");
      }

      try {
        const url = diffConfigTableAllUrl(selectedCacheTypeRef.current, configType, { base: tableBase, rev: combinedRev });
        const cacheKey = `diff:config:table-all:${cacheTypeId}:${configType}:${tableBase}:${combinedRev}`;
        const { data, etag } = await awaitDiffJson<Record<string, unknown>>(cacheKey, url);

        if (requestId !== tableSearchIndexRequestRef.current) return;

        const parsed = parseConfigTablePayload(data as Record<string, unknown>);
        if (parsed.decoding) {
          setTableSearchIndex(null);
          setTableSearchIndexStatus("idle");
          return;
        }

        const allRows = parsed.rows;
        const sourceFingerprint = etag ?? `all:${configType}:${tableBase}:${combinedRev}:count:${allRows.length}`;

        const nextIndex = buildConfigArchiveTableSearchIndex(allRows, {
          combinedRev,
          sourceFingerprint,
          gamevalBulkFilter: gvReadyForBulk ? gamevalBulkFilterRef.current : null,
          lookupGameval: lookupGamevalRef.current,
          getGamevalExtra: getGamevalExtraRef.current,
        });

        if (requestId !== tableSearchIndexRequestRef.current) return;

        if (!cached || cached.sourceFingerprint !== nextIndex.sourceFingerprint) {
          setTableSearchIndex(nextIndex);
          void putTableSearchIndex(tableSearchIndexCacheKey, nextIndex);
        }
        setTableSearchIndexStatus("ready");
      } catch (e) {
        if (requestId !== tableSearchIndexRequestRef.current) return;
        if (!hydrated) {
          setTableSearchIndex(null);
          setTableSearchIndexStatus("error");
        }
        setTableSearchIndexError(e instanceof Error ? e.message : `Failed to index ${labels.tableEntityPlural}`);
      }
    };

    void run();
  }, [
    isCombined,
    viewMode,
    indexedQueryActive,
    tableSearchIndexCacheKey,
    configType,
    tableBase,
    combinedRev,
    cacheTypeId,
    labels.tableEntityPlural,
    gvReadyForBulk,
  ]);

  const indexedSearchResult = React.useMemo(() => {
    if (!indexedQueryActive || !tableSearchIndex) return null;
    const safeOffset = Math.max(0, (page - 1) * perPage);
    return searchConfigArchiveTableIndexPage(tableSearchIndex, {
      mode: tableSearchMode,
      tableQuery: debouncedTableQuery,
      gamevalTags,
      gamevalTextFragment: debouncedGamevalTextFragment,
      searchFieldByMode: tableSearch.searchFieldByMode,
      offset: safeOffset,
      limit: perPage,
    });
  }, [
    indexedQueryActive,
    tableSearchIndex,
    page,
    perPage,
    tableSearchMode,
    debouncedTableQuery,
    gamevalTags,
    debouncedGamevalTextFragment,
    tableSearch.searchFieldByMode,
  ]);

  const indexedClientPageActive =
    viewMode === "table" && indexedQueryActive && indexedSearchResult !== null && tableSearchIndexStatus === "ready";

  const serverMode = tableSearchMode;
  const serverQ =
    tableSearchMode === "gameval"
      ? gamevalApiQuery || undefined
      : debouncedTableQuery.length > 0
      ? debouncedTableQuery
      : undefined;

  const tableServerPageKey = React.useMemo(() => {
    return [
      cacheTypeId,
      configType,
      String(tableBase),
      String(combinedRev),
      serverMode,
      serverQ ?? "",
      String(page),
      String(perPage),
    ].join("\u0000");
  }, [cacheTypeId, configType, tableBase, combinedRev, serverMode, serverQ, page, perPage]);

  const cacheServerPage = React.useCallback((key: string, value: TablePageCacheEntry) => {
    const cache = tablePageCacheRef.current;
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > TABLE_PAGE_CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (!oldest) break;
      cache.delete(oldest);
    }
  }, []);

  React.useEffect(() => {
    if (!isCombined || combinedRev < GAMEVAL_MIN_REVISION) return;
    for (const t of gamevalTypesToPreload) {
      void loadGamevalType(t, combinedRev);
    }
  }, [isCombined, combinedRev, loadGamevalType, gamevalTypesToPreload]);

  const headerGamevalType = React.useMemo(() => configTypeToHeaderGamevalType(configType), [configType]);

  React.useEffect(() => {
    if (!isCombined || combinedRev < GAMEVAL_MIN_REVISION) return;
    if (!headerGamevalType) return;
    void loadGamevalType(headerGamevalType, combinedRev);
  }, [isCombined, combinedRev, headerGamevalType, loadGamevalType]);

  React.useEffect(() => {
    if (!isCombined || !gamevalAutocomplete?.restrictToCombinedSpriteIds) {
      setCombinedSpriteIds(null);
      return;
    }

    const requestId = ++combinedSpritesRequestRef.current;
    setCombinedSpriteIds(null);

    const run = async () => {
      try {
        const url = combinedSpritesUrl(selectedCacheTypeRef.current, combinedRev, tableBase);
        const cacheKey = `diff:combined:sprites:${cacheTypeId}:${tableBase}:${combinedRev}`;
        const { data } = await awaitDiffJson<Record<string, unknown>>(cacheKey, url);

        if (requestId !== combinedSpritesRequestRef.current) return;

        const dataTyped = data as { status?: string; spriteIds?: unknown };

        if (dataTyped.status === "decoding" || dataTyped.status === "missing") {
          setCombinedSpriteIds([]);
          return;
        }

        const raw = Array.isArray(dataTyped.spriteIds) ? dataTyped.spriteIds : [];
        const ids = raw.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
        setCombinedSpriteIds(ids);
      } catch {
        if (requestId !== combinedSpritesRequestRef.current) return;
        setCombinedSpriteIds([]);
      }
    };

    void run();
  }, [isCombined, combinedRev, cacheTypeId, gamevalAutocomplete?.restrictToCombinedSpriteIds, tableBase]);

  React.useEffect(() => {
    if (!isCombined || viewMode !== "table") return;
    if (indexedClientPageActive) return;
    if (syntaxDrivenClientTableActive) return;
    if (tableSearchMode === "gameval" && gamevalClientFilterActive && gamevalBulkFilterRef.current) return;

    const cachedPage = tablePageCacheRef.current.get(tableServerPageKey);
    if (cachedPage) {
      setTableRows(cachedPage.rows);
      setTableTotal(cachedPage.total);
      setTableStatus(cachedPage.status);
      setTableError(null);
      setClientFilteredRows(null);
      setClientFetchStatus("idle");
      setClientFetchError(null);
      return;
    }

    const requestId = ++tableRequestRef.current;
    setTableStatus("loading");
    setTableError(null);
    setClientFilteredRows(null);
    setClientFetchStatus("idle");
    setClientFetchError(null);

    const offset = (page - 1) * perPage;
    const nextPageOffset = offset + perPage;

    const run = async () => {
      try {
        const url = diffConfigTableUrl(selectedCacheTypeRef.current, configType, {
          base: tableBase,
          rev: combinedRev,
          offset,
          limit: perPage,
          q: serverQ,
          mode: serverMode,
        });
        const cacheKey = `diff:config:table:${cacheTypeId}:${url}`;
        const { data } = await awaitDiffJson<Record<string, unknown>>(cacheKey, url);

        if (requestId !== tableRequestRef.current) return;

        const dataRecord = data as Record<string, unknown>;

        const parsed = parseConfigTablePayload(dataRecord);
        if (parsed.decoding) {
          setTableRows([]);
          setTableTotal(0);
          setTableStatus("decoding");
          cacheServerPage(tableServerPageKey, { rows: [], total: 0, status: "decoding" });
          return;
        }

        setTableRows(parsed.rows);
        setTableTotal(parsed.total);
        setTableStatus("ok");
        cacheServerPage(tableServerPageKey, { rows: parsed.rows, total: parsed.total, status: "ok" });

        // Prefetch adjacent page data to make page switching feel instant.
        if (nextPageOffset < parsed.total) {
          const nextPage = page + 1;
          const nextPageKey = [
            cacheTypeId,
            configType,
            String(tableBase),
            String(combinedRev),
            serverMode,
            serverQ ?? "",
            String(nextPage),
            String(perPage),
          ].join("\u0000");
          if (!tablePageCacheRef.current.has(nextPageKey)) {
            void (async () => {
              try {
                const nextUrl = diffConfigTableUrl(selectedCacheTypeRef.current, configType, {
                  base: tableBase,
                  rev: combinedRev,
                  offset: nextPageOffset,
                  limit: perPage,
                  q: serverQ,
                  mode: serverMode,
                });
                const nextCacheKey = `diff:config:table:${cacheTypeId}:${nextUrl}`;
                const { data: nextData } = await awaitDiffJson<Record<string, unknown>>(nextCacheKey, nextUrl);
                const nextParsed = parseConfigTablePayload(nextData as Record<string, unknown>);
                if (nextParsed.decoding) {
                  cacheServerPage(nextPageKey, { rows: [], total: 0, status: "decoding" });
                  return;
                }
                cacheServerPage(nextPageKey, {
                  rows: nextParsed.rows,
                  total: nextParsed.total,
                  status: "ok",
                });
              } catch {
                // Ignore prefetch failures; normal fetch path will handle errors.
              }
            })();
          }
        }
      } catch (e) {
        if (requestId !== tableRequestRef.current) return;
        setTableRows([]);
        setTableTotal(0);
        setTableStatus("error");
        setTableError(e instanceof Error ? e.message : `Failed to ${labels.tableErrorVerb}`);
      }
    };

    void run();
  }, [
    isCombined,
    viewMode,
    combinedRev,
    page,
    perPage,
    tableSearchMode,
    gamevalClientFilterActive,
    hasGamevalBulkFilter,
    debouncedTableQuery,
    cacheTypeId,
    configType,
    tableBase,
    labels.tableErrorVerb,
    syntaxDrivenClientTableActive,
    tableServerPageKey,
    serverMode,
    serverQ,
    cacheServerPage,
  ]);

  React.useEffect(() => {
    if (!isCombined || viewMode !== "table") return;

    if (indexedClientPageActive) {
      setClientFilteredRows(null);
      setClientFetchStatus("idle");
      setClientFetchError(null);
      return;
    }

    if (!syntaxDrivenClientTableActive) {
      if (!(tableSearchMode === "gameval" && gamevalClientFilterActive && hasGamevalBulkFilter)) {
        setClientFilteredRows(null);
        setClientFetchStatus("idle");
        setClientFetchError(null);
      }
      return;
    }

    const requestId = ++syntaxBulkRequestRef.current;
    setClientFetchStatus("loading");
    setClientFetchError(null);
    setClientFilteredRows(null);

    const run = async () => {
      try {
        const all: ConfigArchiveTableRow[] = [];
        let offset = 0;
        let serverTotal = Number.POSITIVE_INFINITY;
        const pageSize = bulkPageSize;
        const qLower = debouncedTableQuery.trim().toLowerCase();

        while (offset < serverTotal) {
          if (requestId !== syntaxBulkRequestRef.current) return;

          const url = diffConfigTableUrl(selectedCacheTypeRef.current, configType, {
            base: tableBase,
            rev: combinedRev,
            offset,
            limit: pageSize,
            q: undefined,
            mode: "id",
          });
          const cacheKey = `diff:config:table:${cacheTypeId}:${url}`;
          const { data } = await awaitDiffJson<Record<string, unknown>>(cacheKey, url);

          if (requestId !== syntaxBulkRequestRef.current) return;

          const parsed = parseConfigTablePayload(data as Record<string, unknown>);
          if (parsed.decoding) {
            setClientFilteredRows([]);
            setClientFetchStatus("ok");
            return;
          }

          serverTotal = parsed.total;
          all.push(...parsed.rows);
          if (parsed.rows.length === 0 || parsed.rows.length < pageSize) break;
          offset += pageSize;
        }

        if (requestId !== syntaxBulkRequestRef.current) return;

        const rawQ = debouncedTableQuery;
        const filtered = all.filter((row) => {
          const idHit = idQueryMatchesNumericId(row.id, rawQ);
          if (tableSearchMode === "id" || tableSearchMode === "regex") return idHit;
          return idHit || archiveRowEntryStringsIncludeQuery(row, qLower);
        });

        setClientFilteredRows(filtered);
        setClientFetchStatus("ok");
      } catch (e) {
        if (requestId !== syntaxBulkRequestRef.current) return;
        setClientFilteredRows(null);
        setClientFetchStatus("error");
        setClientFetchError(e instanceof Error ? e.message : `Failed to ${labels.tableErrorVerb}`);
      }
    };

    void run();
  }, [
    isCombined,
    viewMode,
    combinedRev,
    cacheTypeId,
    syntaxDrivenClientTableActive,
    tableSearchMode,
    debouncedTableQuery,
    bulkPageSize,
    configType,
    tableBase,
    labels.tableErrorVerb,
  ]);

  React.useEffect(() => {
    if (!isCombined || viewMode !== "table" || !hasGamevalBulkFilter) return;

    if (indexedClientPageActive) {
      setClientFilteredRows(null);
      setClientFetchStatus("idle");
      setClientFetchError(null);
      return;
    }

    if (!(tableSearchMode === "gameval" && gamevalClientFilterActive)) {
      if (!syntaxDrivenClientTableActive) {
        setClientFilteredRows(null);
        setClientFetchStatus("idle");
        setClientFetchError(null);
      }
      return;
    }

    if (!gvReadyForBulk) {
      setClientFilteredRows(null);
      setClientFetchStatus("loading");
      setClientFetchError(null);
      return;
    }

    const requestId = ++gamevalBulkRequestRef.current;
    setClientFetchStatus("loading");
    setClientFetchError(null);
    setClientFilteredRows(null);

    const run = async () => {
      try {
        const fns = { lookupGameval, getGamevalExtra } as const;
        const all: ConfigArchiveTableRow[] = [];
        let offset = 0;
        let serverTotal = Number.POSITIVE_INFINITY;

        while (offset < serverTotal) {
          if (requestId !== gamevalBulkRequestRef.current) return;

          const url = diffConfigTableUrl(selectedCacheTypeRef.current, configType, {
            base: tableBase,
            rev: combinedRev,
            offset,
            limit: bulkPageSize,
            q: undefined,
            mode: "id",
          });
          const cacheKey = `diff:config:table:${cacheTypeId}:${url}`;
          const { data } = await awaitDiffJson<Record<string, unknown>>(cacheKey, url);

          if (requestId !== gamevalBulkRequestRef.current) return;

          const dataRecord = data as Record<string, unknown>;
          if (requestId !== gamevalBulkRequestRef.current) return;

          const parsed = parseConfigTablePayload(dataRecord);
          if (parsed.decoding) {
            setClientFilteredRows([]);
            setClientFetchStatus("ok");
            return;
          }

          serverTotal = parsed.total;
          all.push(...parsed.rows);
          if (parsed.rows.length === 0 || parsed.rows.length < bulkPageSize) break;
          offset += bulkPageSize;
        }

        if (requestId !== gamevalBulkRequestRef.current) return;

        const bulkCfg = gamevalBulkFilterRef.current;
        if (!bulkCfg) return;

        const filtered = all.filter((row) => {
          const id = bulkCfg.rowToFilterId(row);
          if (id == null) return false;
          if (!matchesSpriteGamevalTags(bulkCfg.filterGamevalType, id, gamevalTags, combinedRev, fns)) {
            return false;
          }
          const q = debouncedGamevalTextFragment.trim();
          if (!q) return true;
          if (looksLikeSpriteIdQueryText(debouncedGamevalTextFragment)) {
            const rowId = row.id;
            return (
              idQueryMatchesNumericId(id, debouncedGamevalTextFragment) ||
              idQueryMatchesNumericId(rowId, debouncedGamevalTextFragment)
            );
          }
          return spriteMatchesSubstringName(bulkCfg.filterGamevalType, id, debouncedGamevalTextFragment, combinedRev, fns);
        });

        setClientFilteredRows(filtered);
        setClientFetchStatus("ok");
      } catch (e) {
        if (requestId !== gamevalBulkRequestRef.current) return;
        setClientFilteredRows(null);
        setClientFetchStatus("error");
        setClientFetchError(e instanceof Error ? e.message : `Failed to ${labels.gamevalFilterErrorVerb}`);
      }
    };

    void run();
  }, [
    isCombined,
    viewMode,
    combinedRev,
    cacheTypeId,
    tableSearchMode,
    gamevalClientFilterActive,
    gvReadyForBulk,
    hasGamevalBulkFilter,
    gamevalBulkFilter?.filterGamevalType,
    bulkPageSize,
    gamevalTags,
    debouncedGamevalTextFragment,
    lookupGameval,
    getGamevalExtra,
    configType,
    tableBase,
    labels.gamevalFilterErrorVerb,
    syntaxDrivenClientTableActive,
  ]);

  React.useEffect(() => {
    setPage(1);
  }, [
    isCombined,
    isDiff,
    viewMode,
    perPage,
    tableSearchMode,
    debouncedTableQuery,
    gamevalApiQuery,
    combinedRev,
    baseRev,
    rev,
    configType,
  ]);

  React.useEffect(() => {
    setSearchText("");
    setGamevalTags([]);
  }, [configType]);

  const buildCombinedTextHeaderOptions = React.useCallback(
    () => ({
      headerLabelForId:
        headerGamevalType && combinedRev >= GAMEVAL_MIN_REVISION
          ? (id: number) =>
              lookupGameval(headerGamevalType, id, combinedRev)?.trim() ||
              getGamevalExtra(headerGamevalType, id, combinedRev)?.searchable?.trim() ||
              undefined
          : undefined,
    }),
    [combinedRev, getGamevalExtra, headerGamevalType, lookupGameval],
  );

  const headerGamevalRev =
    headerGamevalType == null
      ? combinedRev
      : isCombined
        ? combinedRev
        : Math.max(baseRev, rev);

  const headerGamevalReady =
    !headerGamevalType ||
    headerGamevalRev < GAMEVAL_MIN_REVISION ||
    hasLoaded(headerGamevalType, headerGamevalRev);

  /** Once gamevals arrive, rewrite any leftover `[item_123]` titles in already-loaded text. */
  React.useEffect(() => {
    if (viewMode !== "text") return;
    if (!headerGamevalType || !headerGamevalReady) return;
    const labelFor = (id: number) =>
      lookupGameval(headerGamevalType, id, headerGamevalRev)?.trim() ||
      getGamevalExtra(headerGamevalType, id, headerGamevalRev)?.searchable?.trim() ||
      undefined;
    setContentLines((prev) => {
      if (prev.length === 0) return prev;
      return relabelConfigSectionHeaders(prev, configType, labelFor);
    });
  }, [
    configType,
    getGamevalExtra,
    headerGamevalReady,
    headerGamevalRev,
    headerGamevalType,
    lookupGameval,
    viewMode,
  ]);

  const loadMoreCombinedText = React.useCallback(async () => {
    if (!isCombined || viewMode !== "text") return;
    const feed = textFeedRef.current;
    if (!feed.hasMore || feed.loadingMore) return;
    const requestId = contentRequestRef.current;
    setTextFeed((f) => ({ ...f, loadingMore: true }));
    try {
      const search = new URLSearchParams({
        type: normalizeConfigTypeForCacheApi(configType),
        rev: String(combinedRev),
        offset: String(feed.nextOffset),
        limit: String(COMBINED_TEXT_PAGE_SIZE),
      });
      const url = cacheDataUrl(selectedCacheTypeRef.current, search);
      const cacheKey = `cache:config:content:${cacheTypeId}:${configType}:${combinedRev}:o${feed.nextOffset}:l${COMBINED_TEXT_PAGE_SIZE}`;
      const { data } = await awaitDiffJson<unknown>(cacheKey, url);
      if (requestId !== contentRequestRef.current) return;
      const linesResult = configLinesFromCachePayload(data, configType, buildCombinedTextHeaderOptions());
      if (linesResult === null) {
        setTextFeed((f) => ({ ...f, loadingMore: false }));
        return;
      }
      const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      const hasMore = o.hasMore === true;
      const total = typeof o.total === "number" ? o.total : feed.total;
      setContentLines((prev) => prev.concat(linesResult));
      setTextFeed({
        nextOffset: feed.nextOffset + COMBINED_TEXT_PAGE_SIZE,
        total,
        hasMore,
        loadingMore: false,
      });
    } catch {
      if (requestId !== contentRequestRef.current) return;
      setTextFeed((f) => ({ ...f, loadingMore: false }));
    }
  }, [
    awaitDiffJson,
    buildCombinedTextHeaderOptions,
    cacheTypeId,
    combinedRev,
    configType,
    isCombined,
    viewMode,
  ]);
  loadMoreCombinedTextRef.current = loadMoreCombinedText;

  React.useEffect(() => {
    const wantsText = viewMode === "text";
    if (!wantsText || (!isCombined && !isDiff)) return;

    // Prefer gameval titles before first paint when this config type has them.
    if (
      (isCombined || isDiff) &&
      headerGamevalType &&
      headerGamevalRev >= GAMEVAL_MIN_REVISION &&
      !headerGamevalReady
    ) {
      void loadGamevalType(headerGamevalType, headerGamevalRev);
      return;
    }

    const requestId = ++contentRequestRef.current;
    setContentStatus("loading");
    setContentError(null);
    setTextFeed({ nextOffset: 0, total: 0, hasMore: false, loadingMore: false });
    setContentLines([]);

    const headerOpts = buildCombinedTextHeaderOptions();
    // Diff text uses the newer rev for gameval names.
    const diffHeaderOpts =
      headerGamevalType && headerGamevalRev >= GAMEVAL_MIN_REVISION
        ? {
            headerLabelForId: (id: number) =>
              lookupGameval(headerGamevalType, id, headerGamevalRev)?.trim() ||
              getGamevalExtra(headerGamevalType, id, headerGamevalRev)?.searchable?.trim() ||
              undefined,
          }
        : undefined;

    const run = async () => {
      try {
        let url: string;
        let cacheKey: string;
        if (isDiff) {
          const o = diffCacheOrderedPair(baseRev, rev);
          url = diffConfigContentUrl(selectedCacheTypeRef.current, configType, o);
          cacheKey = `diff:config:content:${cacheTypeId}:${configType}:pair:${o.base}:${o.rev}`;
        } else {
          const search = new URLSearchParams({
            type: normalizeConfigTypeForCacheApi(configType),
            rev: String(combinedRev),
            offset: "0",
            limit: String(COMBINED_TEXT_PAGE_SIZE),
          });
          url = cacheDataUrl(selectedCacheTypeRef.current, search);
          cacheKey = `cache:config:content:${cacheTypeId}:${configType}:${combinedRev}:o0:l${COMBINED_TEXT_PAGE_SIZE}`;
        }
        const { data } = await awaitDiffJson<unknown>(cacheKey, url);

        if (requestId !== contentRequestRef.current) return;

        const dataUnknown: unknown = data;
        const linesResult = isDiff
          ? configLinesFromContentPayload(dataUnknown, diffHeaderOpts)
          : configLinesFromCachePayload(dataUnknown, configType, headerOpts);
        if (linesResult === null) {
          setContentLines([]);
          setContentStatus("decoding");
          return;
        }
        setContentLines(linesResult);
        if (!isDiff && dataUnknown && typeof dataUnknown === "object") {
          const o = dataUnknown as Record<string, unknown>;
          const total = typeof o.total === "number" ? o.total : linesResult.length;
          const hasMore = o.hasMore === true;
          setTextFeed({
            nextOffset: COMBINED_TEXT_PAGE_SIZE,
            total,
            hasMore,
            loadingMore: false,
          });
        } else {
          setTextFeed({ nextOffset: 0, total: 0, hasMore: false, loadingMore: false });
        }
        setContentStatus("ok");
      } catch (e) {
        if (requestId !== contentRequestRef.current) return;
        setContentLines([]);
        setContentStatus("error");
        setContentError(e instanceof Error ? e.message : `Failed to ${labels.contentErrorVerb}`);
      }
    };

    void run();
  }, [
    isCombined,
    isDiff,
    viewMode,
    combinedRev,
    baseRev,
    rev,
    cacheTypeId,
    configType,
    tableBase,
    labels.contentErrorVerb,
    buildCombinedTextHeaderOptions,
    awaitDiffJson,
    headerGamevalReady,
    headerGamevalRev,
    headerGamevalType,
    loadGamevalType,
    lookupGameval,
    getGamevalExtra,
  ]);

  const textFindMatcher = React.useMemo(():
    | { mode: "empty" }
    | { mode: "bad"; error: string }
    | { mode: "ok"; test: (line: string) => boolean } => {
    const q = debouncedTextFindQuery.trim();
    if (!q) return { mode: "empty" };
    return {
      mode: "ok",
      test: (line: string) => lineMatchesTextQuery(line, q),
    };
  }, [debouncedTextFindQuery]);

  const textFindHighlightQuery = React.useMemo(() => {
    const needles = queryHighlightNeedles(debouncedTextFindQuery);
    return needles[0] ?? debouncedTextFindQuery;
  }, [debouncedTextFindQuery]);

  const contentBlocks = React.useMemo(() => getConfigBlocks(contentLines), [contentLines]);

  const textLineKindByIndex = React.useMemo((): ("add" | "removed" | "change" | "context")[] => {
    const addDelta = new Int32Array(contentLines.length + 1);
    const remDelta = new Int32Array(contentLines.length + 1);
    for (const b of contentBlocks) {
      const end = trimBlockEndExclusive(contentLines, b);
      if (b.start >= end) continue;
      if (b.type === "add") {
        addDelta[b.start] += 1;
        addDelta[end] -= 1;
      } else if (b.type === "removed") {
        remDelta[b.start] += 1;
        remDelta[end] -= 1;
      }
    }
    const out: ("add" | "removed" | "change" | "context")[] = [];
    let addDepth = 0;
    let remDepth = 0;
    for (let i = 0; i < contentLines.length; i++) {
      const row = contentLines[i]!;
      addDepth += addDelta[i] ?? 0;
      remDepth += remDelta[i] ?? 0;
      if (row.type === "change") {
        out.push("change");
        continue;
      }
      if (addDepth > 0) out.push("add");
      else if (remDepth > 0) out.push("removed");
      else if (row.type === "add") out.push("add");
      else if (row.type === "removed") out.push("removed");
      else out.push("context");
    }
    return out;
  }, [contentLines, contentBlocks]);

  const textLineDisplayIndices = React.useMemo(() => {
    if (viewMode !== "text") return [];
    return contentLines.map((_, i) => i);
  }, [viewMode, contentLines]);

  const textMatchIndices = React.useMemo(() => {
    if (textFindMatcher.mode !== "ok") return [];
    if (viewMode !== "text") return [];
    const test = textFindMatcher.test;
    const out: number[] = [];
    for (const i of textLineDisplayIndices) {
      if (test(contentLines[i]?.line ?? "")) out.push(i);
    }
    return out;
  }, [contentLines, textFindMatcher, viewMode, textLineDisplayIndices]);

  const textMatchSet = React.useMemo(() => new Set(textMatchIndices), [textMatchIndices]);

  const resolvedTextRowHeight =
    typeof textRowHeight === "function" ? textRowHeight(settings) : textRowHeight;

  const sectionMetas = React.useMemo(
    () => buildSectionMetas(contentLines, textLineKindByIndex),
    [contentLines, textLineKindByIndex],
  );

  const sectionTitleHoverByLineIndex = React.useMemo(
    () => buildSectionTitleHoverByLineIndex(contentLines, sectionMetas, configType, focusBracketTitle),
    [contentLines, sectionMetas, configType, focusBracketTitle],
  );

  const definitionLabel = React.useMemo(() => {
    const t = configType.trim().toLowerCase();
    if (!t) return undefined;
    return `config.${t}`;
  }, [configType]);

  const textViewRows = React.useMemo(
    (): TextViewRow[] => buildTextViewRowsWithHeaders(textLineDisplayIndices, sectionMetas),
    [sectionMetas, textLineDisplayIndices],
  );

  const textDisplayPositionBySourceIndex = React.useMemo(() => {
    const map = new Map<number, number>();
    for (let vi = 0; vi < textViewRows.length; vi++) {
      const row = textViewRows[vi]!;
      if (row.kind === "line") map.set(row.lineIndex, vi);
    }
    return map;
  }, [textViewRows]);

  const textRowHeights = React.useMemo(() => {
    const base = resolvedTextRowHeight;
    if (!wordWrap || viewMode !== "text") {
      return textViewRows.map(() => base);
    }
    const cols = isDiff && diffLayout === "split" ? 2 : 1;
    const chars = estimateCharsPerLine(textViewportWidth, cols);
    return textViewRows.map((viewRow) => {
      if (viewRow.kind === "header") return base;
      const text = contentLines[viewRow.lineIndex]?.line ?? " ";
      // Split layout uses the longer of before/after for height.
      if (isDiff && diffLayout === "split") {
        const row = contentLines[viewRow.lineIndex];
        const before = row?.before ?? "";
        const units = Math.max(
          estimateWrappedRowUnits(text, chars),
          estimateWrappedRowUnits(before, chars),
        );
        return units * base;
      }
      return estimateWrappedRowUnits(text, chars) * base;
    });
  }, [
    contentLines,
    diffLayout,
    isDiff,
    resolvedTextRowHeight,
    textViewRows,
    textViewportWidth,
    viewMode,
    wordWrap,
  ]);

  const textRowPrefix = React.useMemo(() => buildPrefixOffsets(textRowHeights), [textRowHeights]);

  const textVirtualWindow = React.useMemo(() => {
    if (viewMode !== "text") {
      return { start: 0, end: 0, topPx: 0, totalRows: 0, totalH: 0, rowH: resolvedTextRowHeight };
    }
    const total = textViewRows.length;
    if (total === 0) {
      return { start: 0, end: 0, topPx: 0, totalRows: 0, totalH: 0, rowH: resolvedTextRowHeight };
    }
    if (!wordWrap) {
      const rowH = resolvedTextRowHeight;
      const { scrollTop, clientHeight } = textVirt;
      const ch = Math.max(clientHeight, 1);
      const start = Math.max(0, Math.floor(scrollTop / rowH) - textOverscan);
      const end = Math.min(total, Math.ceil((scrollTop + ch) / rowH) + textOverscan);
      return { start, end, topPx: start * rowH, totalRows: total, totalH: total * rowH, rowH };
    }
    const win = virtualWindowFromOffsets(
      textRowPrefix,
      textVirt.scrollTop,
      textVirt.clientHeight,
      textOverscan,
    );
    return {
      start: win.start,
      end: win.end,
      topPx: win.topPx,
      totalRows: total,
      totalH: win.totalH,
      rowH: resolvedTextRowHeight,
    };
  }, [
    viewMode,
    textViewRows,
    textVirt,
    resolvedTextRowHeight,
    textOverscan,
    wordWrap,
    textRowPrefix,
  ]);

  const minimapMarks = React.useMemo(() => {
    const marks: { topPct: number; kind: "add" | "removed" | "change" }[] = [];
    const n = textViewRows.length;
    if (n === 0) return marks;
    for (let vi = 0; vi < n; vi++) {
      const row = textViewRows[vi]!;
      if (row.kind !== "line") continue;
      const dk = textLineKindByIndex[row.lineIndex] ?? "context";
      if (dk === "context") continue;
      marks.push({ topPct: (vi / n) * 100, kind: dk });
    }
    return marks;
  }, [textLineKindByIndex, textViewRows]);

  React.useEffect(() => {
    const n = textMatchIndices.length;
    setTextFindActiveIdx((i) => {
      if (n === 0) return 0;
      return Math.min(Math.max(0, i), n - 1);
    });
  }, [textMatchIndices]);

  const activeTextLineIndex =
    textMatchIndices.length > 0
      ? textMatchIndices[Math.min(textFindActiveIdx, textMatchIndices.length - 1)]!
      : null;

  React.useLayoutEffect(() => {
    if (viewMode !== "text" || contentStatus !== "ok") return;
    const el = textScrollRef.current;
    if (!el) return;
    setTextVirt((v) => ({
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight > 0 ? el.clientHeight : v.clientHeight,
    }));
  }, [viewMode, contentStatus, contentLines.length, textLineDisplayIndices.length]);

  React.useEffect(() => {
    if (viewMode !== "text" || activeTextLineIndex == null) return;
    const root = textScrollRef.current;
    if (!root) return;
    const displayPos = textDisplayPositionBySourceIndex.get(activeTextLineIndex);
    if (displayPos == null) return;
    const rowTop = textRowPrefix[displayPos] ?? displayPos * resolvedTextRowHeight;
    const rowH = textRowHeights[displayPos] ?? resolvedTextRowHeight;
    const viewTop = root.scrollTop;
    const viewH = root.clientHeight;
    const pad = 8;
    if (rowTop < viewTop + pad) {
      root.scrollTop = Math.max(0, rowTop - pad);
    } else if (rowTop + rowH > viewTop + viewH - pad) {
      root.scrollTop = rowTop - viewH + rowH + pad;
    }
  }, [
    viewMode,
    activeTextLineIndex,
    textFindActiveIdx,
    resolvedTextRowHeight,
    textDisplayPositionBySourceIndex,
    textRowPrefix,
    textRowHeights,
  ]);

  /** Inspector jump: scroll to `// id` even when the bracket title is a gameval name. */
  React.useEffect(() => {
    if (!focusNonce || !focusBracketTitle || viewMode !== "text") return;
    const root = textScrollRef.current;
    if (!root || contentLines.length === 0) return;
    let resolvedId = parseFocusEntityId(focusBracketTitle);
    if (resolvedId == null && headerGamevalType) {
      const name = bareFocusTitle(focusBracketTitle);
      if (name) {
        resolvedId = lookupGamevalByName(headerGamevalType, name, combinedRev) ?? null;
      }
    }
    const sourceIdx = findConfigFocusLineIndex(contentLines, focusBracketTitle, resolvedId);
    if (sourceIdx < 0) return;
    const displayPos = textDisplayPositionBySourceIndex.get(sourceIdx);
    if (displayPos == null) return;
    const rowTop = textRowPrefix[displayPos] ?? displayPos * resolvedTextRowHeight;
    root.scrollTop = Math.max(0, rowTop - 8);
    setTextVirt((v) => ({ ...v, scrollTop: root.scrollTop }));
  }, [
    focusBracketTitle,
    focusNonce,
    viewMode,
    contentLines,
    textDisplayPositionBySourceIndex,
    textRowPrefix,
    resolvedTextRowHeight,
    headerGamevalType,
    lookupGamevalByName,
    combinedRev,
  ]);

  const clientSidePagination =
    indexedClientPageActive ||
    (tableSearchMode === "gameval" && gamevalClientFilterActive && hasGamevalBulkFilter) ||
    syntaxDrivenClientTableActive;

  const gamevalBulkClientPageActive =
    viewMode === "table" &&
    tableSearchMode === "gameval" &&
    gamevalClientFilterActive &&
    hasGamevalBulkFilter &&
    gvReadyForBulk &&
    clientFetchStatus === "ok" &&
    clientFilteredRows !== null;

  const syntaxClientPageActive =
    viewMode === "table" &&
    syntaxDrivenClientTableActive &&
    clientFetchStatus === "ok" &&
    clientFilteredRows !== null;

  const clientPageActive = gamevalBulkClientPageActive || syntaxClientPageActive;

  const displayTotal = React.useMemo(() => {
    if (viewMode === "table" && clientSidePagination) {
      if (indexedClientPageActive) return indexedSearchResult!.total;
      if (clientPageActive) return clientFilteredRows!.length;
      return 0;
    }
    return tableTotal;
  }, [
    viewMode,
    clientSidePagination,
    indexedClientPageActive,
    indexedSearchResult,
    clientPageActive,
    clientFilteredRows,
    tableTotal,
  ]);

  const totalPages = Math.max(1, Math.ceil(displayTotal / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const indexedDisplayRows = React.useMemo(() => {
    if (!indexedClientPageActive || !indexedSearchResult) return null;
    if (safePage === page) return indexedSearchResult.rows;

    const safeOffset = Math.max(0, (safePage - 1) * perPage);
    return searchConfigArchiveTableIndexPage(tableSearchIndex!, {
      mode: tableSearchMode,
      tableQuery: debouncedTableQuery,
      gamevalTags,
      gamevalTextFragment: debouncedGamevalTextFragment,
      searchFieldByMode: tableSearch.searchFieldByMode,
      offset: safeOffset,
      limit: perPage,
    }).rows;
  }, [
    indexedClientPageActive,
    indexedSearchResult,
    safePage,
    page,
    perPage,
    tableSearchIndex,
    tableSearchMode,
    debouncedTableQuery,
    gamevalTags,
    debouncedGamevalTextFragment,
    tableSearch.searchFieldByMode,
  ]);

  const displayRows = React.useMemo(() => {
    if (viewMode === "table" && clientSidePagination) {
      const start = (safePage - 1) * perPage;
      const end = safePage * perPage;
      if (indexedClientPageActive) return indexedDisplayRows ?? [];
      if (clientPageActive) return clientFilteredRows!.slice(start, end);
      return [];
    }
    return tableRows;
  }, [
    viewMode,
    clientSidePagination,
    safePage,
    perPage,
    indexedClientPageActive,
    indexedDisplayRows,
    clientPageActive,
    clientFilteredRows,
    tableRows,
  ]);

  const tablePlan = React.useMemo(
    () => buildTablePlan({ displayRows, combinedRev }),
    [buildTablePlan, displayRows, combinedRev],
  );

  const clientDerivedTableLoading =
    (indexedQueryActive && tableSearchIndexStatus === "loading" && tableSearchIndex == null) ||
    (syntaxDrivenClientTableActive && clientFetchStatus === "loading") ||
    (tableSearchMode === "gameval" &&
      gamevalClientFilterActive &&
      hasGamevalBulkFilter &&
      (!gvReadyForBulk || clientFetchStatus === "loading"));

  const tableIsLoading =
    viewMode === "table" &&
    ((!clientSidePagination && tableStatus === "loading") || clientDerivedTableLoading);

  const headlineCount =
    viewMode === "table" ? displayTotal : viewMode === "text" ? textLineDisplayIndices.length : 0;

  const tableHeadlineWord =
    headlineCount === 1 ? labels.tableEntitySingular : labels.tableEntityPlural;
  const textHeadlineWord =
    headlineCount === 1 ? (labels.textLineSingular ?? "line") : (labels.textLinePlural ?? "lines");

  const gamevalRev = archiveGamevalRev;
  const gamevalSupported = gamevalRev >= GAMEVAL_MIN_REVISION;

  const gamevalAllowedIds = React.useMemo((): ReadonlySet<number> | null | undefined => {
    const auto = gamevalAutocompleteRef.current;
    if (!auto?.restrictToCombinedSpriteIds) return undefined;
    if (!gamevalSupported || !auto.enabled(settings.suggestionDisplay)) return undefined;
    if (combinedSpriteIds === null) return null;
    return new Set(combinedSpriteIds);
  }, [
    gamevalAutocomplete?.restrictToCombinedSpriteIds,
    gamevalSupported,
    settings.suggestionDisplay,
    combinedSpriteIds,
  ]);

  const gamevalAutocompleteForField = React.useMemo(() => {
    const auto = gamevalAutocompleteRef.current;
    if (!auto) return undefined;
    return {
      type: auto.type,
      rev: gamevalRev,
      enabled: auto.enabled(settings.suggestionDisplay),
      allowedIds: gamevalAllowedIds,
    };
  }, [
    gamevalAutocomplete?.type,
    gamevalAutocomplete?.restrictToCombinedSpriteIds,
    gamevalRev,
    settings.suggestionDisplay,
    gamevalAllowedIds,
  ]);

  const headerCountLabel = isDiff
    ? `· Base ${baseRev} → Compare ${rev} · ${headlineCount.toLocaleString()} ${textHeadlineWord}`
    : `· ${headlineCount.toLocaleString()} ${viewMode === "text" ? textHeadlineWord : tableHeadlineWord}`;

  return (
    <>
      <DiffSectionHeader
        title={title}
        tooltipContent={
          viewMode === "table"
            ? diffSearchModeTooltipHelp(tableSearchMode)
            : "Use Search all below the viewer to describe or query config text."
        }
        countLabel={headerCountLabel}
        trailing={
          isCombined && !textOnly ? (
            <DiffViewModeToggle
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "table", label: "Table" },
                { value: "text", label: "Text" },
              ]}
            />
          ) : null
        }
      />

      {isCombined && viewMode === "table" && tableStatus === "error" && tableError ? (
        <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {tableError}
        </p>
      ) : null}
      {isCombined && viewMode === "table" && clientFetchStatus === "error" && clientFetchError ? (
        <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {clientFetchError}
        </p>
      ) : null}
      {isCombined && viewMode === "table" && tableSearchIndexError ? (
        <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {tableSearchIndexError}
        </p>
      ) : null}
      {decodeProgress ? (
        <div className="mb-3">
          <DiffDecodeProgressBanner progress={decodeProgress} fallbackMessage={labels.decodingMessage} />
        </div>
      ) : isCombined && viewMode === "table" && tableStatus === "decoding" ? (
        <div className="mb-3">
          <DiffDecodeProgressBanner progress={null} fallbackMessage={labels.decodingMessage} />
        </div>
      ) : viewMode === "text" && contentStatus === "decoding" ? (
        <div className="mb-3">
          <DiffDecodeProgressBanner progress={null} fallbackMessage={labels.decodingMessage} />
        </div>
      ) : null}
      {viewMode === "text" && contentStatus === "error" && contentError ? (
        <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {contentError}
        </p>
      ) : null}

      {isCombined && viewMode === "table" && !hideSearchChrome ? (
        <div className="mb-3 flex w-full min-w-0 flex-wrap items-center gap-2 justify-between px-3 pt-3">
          <div className={cn(DIFF_COMBINED_SEARCH_WRAP_CLASS, tableSearchWrapClassName)}>
            <DiffUnifiedSearchField
            mode={tableSearchMode}
            onModeChange={setTableSearchMode}
              size={tableSearchSize}
            disabledModes={tableSearch.disabledModes}
            modeOptionTitles={tableSearch.modeTitles}
            tagModes={tableSearch.tagModes ?? ["gameval"]}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tableSearchMode === "gameval" && searchText.trim()) {
                e.preventDefault();
                setGamevalTags((prev) => [...prev, { value: searchText.trim(), exact: false }]);
                setSearchText("");
              }
            }}
            tags={gamevalTags}
            onTagToggle={(idx) =>
              setGamevalTags((prev) => prev.map((t, i) => (i === idx ? { ...t, exact: !t.exact } : t)))
            }
            onTagRemove={(idx) => setGamevalTags((prev) => prev.filter((_, i) => i !== idx))}
            onClearTags={() => setGamevalTags([])}
            gamevalAutocomplete={gamevalAutocompleteForField}
          />
          </div>
          {searchRowTrailing ? <div className="flex shrink-0 items-center">{searchRowTrailing}</div> : null}
        </div>
      ) : isCombined && viewMode === "table" && hideSearchChrome ? null : searchRowTrailing && !hideSearchChrome ? (
        <div className="mb-3 flex w-full min-w-0 justify-end">
          <div className="flex shrink-0 items-center">{searchRowTrailing}</div>
        </div>
      ) : null}

      {isCombined && viewMode === "table" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pb-3">
          <DiffArchiveTable
            aria-busy={tableIsLoading}
            aria-label={tableIsLoading ? tablePlan.loadingAriaLabel : tablePlan.readyAriaLabel}
          >
            {tablePlan.colgroup}
            <TableHeader className={DIFF_ARCHIVE_TABLE_HEADER_CLASS}>
              <TableRow>
                <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>ID</TableHead>
                {tablePlan.headerCellsAfterId}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableIsLoading ? (
                tablePlan.renderSkeletonRows(perPage)
              ) : tableStatus === "ok" && displayRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tablePlan.emptyColSpan} className="p-4 text-center text-muted-foreground">
                    {labels.emptyTableMessage}
                  </TableCell>
                </TableRow>
              ) : (
                displayRows.map((row) => tablePlan.renderTableRow(row))
              )}
            </TableBody>
          </DiffArchiveTable>

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
            showingCount={tableIsLoading ? perPage : displayRows.length}
            totalCount={displayTotal}
            countLabel={labels.paginationCountLabel}
          />
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {contentStatus === "loading" ? (
            <div
              className="flex min-h-0 flex-1 items-center justify-center bg-background p-6"
              aria-busy="true"
              aria-label="Loading config text"
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">Loading config text...</p>
              </div>
            </div>
          ) : (
            <div className="relative min-h-0 flex-1">
              <div
                ref={textScrollRef}
                onScroll={onTextScroll}
                className="absolute inset-0 overflow-auto bg-background"
              >
                <DiffChangeMinimap
                  marks={minimapMarks}
                  scrollTop={textVirt.scrollTop}
                  viewportH={textVirt.clientHeight}
                  totalH={textVirtualWindow.totalH}
                />
                <div
                  className="relative pr-2.5 font-mono text-xs"
                  style={{ height: textVirtualWindow.totalH }}
                >
                  {textVirtualWindow.totalRows === 0 ? (
                    isDiff && contentLines.length > 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        No lines match the current change-type filter. Choose &quot;All&quot; to see every line.
                      </div>
                    ) : null
                  ) : (
                    <div
                      className="absolute left-0 right-0"
                      style={{ top: textVirtualWindow.topPx, willChange: "transform" }}
                    >
                      {textViewRows.slice(textVirtualWindow.start, textVirtualWindow.end).map((viewRow, offset) => {
                        const vi = textVirtualWindow.start + offset;
                        const rowH = textRowHeights[vi] ?? textVirtualWindow.rowH;
                        if (viewRow.kind === "header") {
                          const titleLineIndex =
                            viewRow.section.start + 1 < viewRow.section.end
                              ? viewRow.section.start + 1
                              : -1;
                          const hoverInfo =
                            titleLineIndex >= 0 ? sectionTitleHoverByLineIndex.get(titleLineIndex) : undefined;
                          return (
                            <div key={`hdr-${viewRow.section.start}`} style={{ height: rowH }}>
                              <SectionChromeHeader
                                title={viewRow.section.title}
                                added={viewRow.section.added}
                                removed={viewRow.section.removed}
                                isCurrent={sectionMatchesFocus(
                                  viewRow.section.title,
                                  focusBracketTitle,
                                  viewRow.section.entityId,
                                )}
                                hoverInfo={hoverInfo}
                                definitionLabel={definitionLabel}
                              />
                            </div>
                          );
                        }
                        const i = viewRow.lineIndex;
                        const row = contentLines[i]!;
                        const kind = textLineKindByIndex[i] ?? row.type;
                        const debouncedQ = debouncedTextFindQuery.trim();
                        const findOk = textFindMatcher.mode === "ok";
                        return (
                          <ConfigArchiveVirtualTextRow
                            key={i}
                            line={row.line}
                            hoverText={row.hoverText}
                            sectionHover={sectionTitleHoverByLineIndex.get(i)}
                            definitionLabel={definitionLabel}
                            lineType={isDiff ? kind : "context"}
                            addedInRev={row.addedInRev}
                            changedInRev={row.changedInRev}
                            removedInRev={row.removedInRev}
                            before={row.before}
                            layout={isDiff ? diffLayout : "unified"}
                            rowH={rowH}
                            wordWrap={wordWrap}
                            combinedRev={archiveGamevalRev}
                            lookupRevisions={textLookupRevisions}
                            debouncedFindQuery={textFindHighlightQuery.trim() || debouncedQ}
                            findKind="literal"
                            findMarkActive={findOk && textMatchSet.has(i)}
                            TextLine={TextLine}
                            getTextLineShowInline={getTextLineShowInline}
                            settings={settings}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
                {isCombined && (textFeed.hasMore || textFeed.loadingMore || textFeed.total > 0) ? (
                  <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-md border border-border/60 bg-background/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm">
                    {textFeed.loadingMore ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                        Loading more…
                      </span>
                    ) : textFeed.hasMore ? (
                      <span>
                        Loaded {Math.min(textFeed.nextOffset, textFeed.total).toLocaleString()} /{" "}
                        {textFeed.total.toLocaleString()} — scroll for more
                      </span>
                    ) : textFeed.total > 0 ? (
                      <span>{textFeed.total.toLocaleString()} entities</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
