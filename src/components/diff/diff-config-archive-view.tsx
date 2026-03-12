"use client";

import * as React from "react";
import { IconDatabase } from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";

import { OptionDropdown } from "@/components/ui/option-dropdown";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePaginationBar } from "@/components/ui/table-pagination-bar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCacheType } from "@/context/cache-type-context";
import type { GamevalType } from "@/context/gameval-context";
import { INVTYPES, ITEMTYPES, NPCTYPES, OBJTYPES, SEQTYPES, SPOTTYPES } from "@/context/gameval-context";
import { useGamevals } from "@/context/gameval-context";
import { useSettings, type AppSettings } from "@/context/settings-context";
import {
  cacheProxyHeaders,
  combinedSpritesUrl,
  diffCacheOrderedPair,
  diffConfigContentUrl,
  diffConfigTableUrl,
} from "@/lib/cache-proxy-client";
import { conditionalJsonFetch, getTableSearchIndex, putTableSearchIndex } from "@/lib/openrune-idb-cache";
import { cn } from "@/lib/utils";
import { getConfigBlocks, trimBlockEndExclusive, type ConfigSectionBlock } from "@/lib/diff-config-blocks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ChevronDown, ChevronUp, Loader2, Minus, Pencil, Plus, Search } from "lucide-react";

import {
  DIFF_COMBINED_SEARCH_WRAP_CLASS,
  GAMEVAL_MIN_REVISION,
  TEXTURE_PER_PAGE_OPTIONS,
} from "./diff-constants";
import { matchesSpriteGamevalTags, spriteMatchesSubstringName } from "./diff-sprite-gameval-filter";
import { idQueryMatchesNumericId, looksLikeSpriteIdQueryText } from "./diff-id-search";
import {
  buildConfigArchiveTableSearchIndex,
  searchConfigArchiveTableIndex,
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
import { configLinesFromContentPayload } from "./diff-config-content";
import { configLinesFromCachePayload } from "./diff-config-content";
import type { ConfigFilterMode, ConfigLine, DiffSearchFieldMode, SearchTag } from "./diff-types";

const DEFAULT_BULK_PAGE = 500;
const DEFAULT_TEXT_OVERSCAN = 14;
const DEFAULT_FIND_DEBOUNCE_MS = 100;

function configTypeToHeaderGamevalType(configType: string): GamevalType | null {
  switch (configType.trim().toLowerCase()) {
    case "items":
      return ITEMTYPES;
    case "npcs":
      return NPCTYPES;
    case "sequences":
      return SEQTYPES;
    case "spotanim":
    case "spotanims":
      return SPOTTYPES;
    case "inv":
      return INVTYPES;
    case "objects":
      return OBJTYPES;
    default:
      return null;
  }
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
      entries:
        ((r as { entries?: unknown }).entries && typeof (r as { entries?: unknown }).entries === "object"
          ? Object.entries((r as { entries?: Record<string, unknown> }).entries ?? {}).reduce<Record<string, string>>(
              (acc, [k, v]) => {
                acc[k] = valueToEntryString(v);
                return acc;
              },
              {},
            )
          : (r as { fields?: unknown }).fields && typeof (r as { fields?: unknown }).fields === "object"
            ? Object.entries((r as { fields?: Record<string, unknown> }).fields ?? {}).reduce<Record<string, string>>(
                (acc, [k, v]) => {
                  acc[k] = valueToEntryString(v);
                  return acc;
                },
                {},
              )
            : {}),
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
  lineIndex,
  oldLineNumber,
  newLineNumber,
  line,
  lineType,
  hoverText,
  addedInRev,
  changedInRev,
  removedInRev,
  before,
  layout,
  rowH,
  combinedRev,
  debouncedFindQuery,
  findKind,
  findMarkActive,
  TextLine,
  getTextLineShowInline,
  settings,
}: {
  lineIndex: number;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  line: string;
  lineType: ConfigLine["type"];
  hoverText?: string;
  addedInRev?: number;
  changedInRev?: number;
  removedInRev?: number;
  before?: string;
  layout: "unified" | "split";
  rowH: number;
  combinedRev: number;
  debouncedFindQuery: string;
  findKind: "literal" | "regex";
  findMarkActive: boolean;
  TextLine: React.ComponentType<DiffConfigArchiveTextLineProps>;
  getTextLineShowInline?: (s: AppSettings) => boolean;
  settings: AppSettings;
}) {
  const rowTint =
    lineType === "add"
      ? "bg-green-500/8 dark:bg-green-500/12"
      : lineType === "removed"
        ? "bg-red-500/8 dark:bg-red-500/12"
        : lineType === "change"
          ? "bg-amber-500/10 dark:bg-amber-500/14"
          : "";

  const barColor =
    lineType === "add"
      ? "bg-green-500"
      : lineType === "change"
        ? "bg-amber-500"
        : lineType === "removed"
          ? "bg-red-500"
          : "bg-transparent";

  const icon =
    lineType === "add" ? (
      <Plus className="size-3.5 text-green-600 dark:text-green-400" aria-hidden />
    ) : lineType === "removed" ? (
      <Minus className="size-3.5 text-red-600 dark:text-red-400" aria-hidden />
    ) : lineType === "change" ? (
      <Pencil className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
    ) : null;

  const hasRefHover = Boolean(hoverText?.trim());
  const gutterIcon = hasRefHover ? (
    <IconDatabase className="size-3.5 text-sky-700 dark:text-sky-300" aria-hidden />
  ) : icon;

  const beforeDisplay = withFieldPrefixIfMissing(before, line);
  const diffTooltipBody: React.ReactNode =
    lineType === "add" && addedInRev != null
      ? <>Added in rev {addedInRev}</>
      : lineType === "removed" && removedInRev != null
        ? <>Removed in rev {removedInRev}</>
        : lineType === "change" && (changedInRev != null || beforeDisplay != null)
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

  const tooltipBody: React.ReactNode = hasRefHover ? hoverText : diffTooltipBody;

  const iconTrigger: NonNullable<React.ComponentProps<typeof TooltipTrigger>["render"]> = (props) => (
    <span {...props} className={cn("flex w-5 shrink-0 items-center justify-center", props.className)}>
      {gutterIcon}
    </span>
  );

  if (layout === "split") {
    const leftLine = lineType === "add" ? "" : (lineType === "change" ? (beforeDisplay ?? before ?? line) : line);
    const rightLine = lineType === "removed" ? "" : line;
    const leftTint =
      lineType === "change"
        ? "bg-amber-500/16 dark:bg-amber-500/14"
        : lineType === "removed"
        ? "bg-red-500/16 dark:bg-red-500/14"
        : "bg-transparent";
    const rightTint =
      lineType === "change"
        ? "bg-amber-500/16 dark:bg-amber-500/14"
        : lineType === "add"
        ? "bg-green-500/16 dark:bg-green-500/14"
        : "bg-transparent";

    const leftMarker = lineType === "change" ? "~" : (lineType === "removed" ? "-" : " ");
    const rightMarker = lineType === "change" ? "~" : (lineType === "add" ? "+" : " ");

    const leftMarkerText =
      lineType === "change" ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400";
    const rightMarkerText =
      lineType === "change" ? "text-amber-700 dark:text-amber-400" : "text-green-700 dark:text-green-400";

    const splitMarker = (
      marker: string,
      className: string,
      side: "left" | "right",
    ) => {
      const node = <span className={className}>{marker}</span>;
      if (marker.trim() === "" || !diffTooltipBody) return node;
      return (
        <Tooltip>
          <TooltipTrigger render={node} />
          <TooltipContent
            opaque
            side={side === "left" ? "left" : "right"}
            className="max-w-sm border border-zinc-800 bg-zinc-950 p-3 text-xs text-white"
          >
            {diffTooltipBody}
          </TooltipContent>
        </Tooltip>
      );
    };

    return (
      <div className="flex items-stretch" style={{ height: rowH }}>
        <div className="flex min-w-0 flex-1 border-r border-border/40">
          <div className="flex w-14 shrink-0 select-none items-center justify-end border-r bg-muted/35 pr-2 font-mono text-[11px] tabular-nums text-muted-foreground">
            {oldLineNumber ?? ""}
          </div>
          <div className={cn("flex w-6 shrink-0 select-none items-center justify-center border-r bg-muted/25 font-mono text-[11px]", leftMarkerText)}>
            {splitMarker(
              leftMarker,
              "flex h-full w-full items-center justify-center",
              "left",
            )}
          </div>
          <div className={cn("min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden px-3 py-0.5 text-xs leading-[22px]", leftTint)}>
            <TextLine
              line={leftLine || " "}
              combinedRev={combinedRev}
              hoverText={hoverText}
              showInline={getTextLineShowInline?.(settings)}
              findKind={findKind}
              findQuery={debouncedFindQuery}
              findMarkActive={findMarkActive}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-1">
          <div className="flex w-14 shrink-0 select-none items-center justify-end border-r bg-muted/35 pr-2 font-mono text-[11px] tabular-nums text-muted-foreground">
            {newLineNumber ?? ""}
          </div>
          <div className={cn("flex w-6 shrink-0 select-none items-center justify-center border-r bg-muted/25 font-mono text-[11px]", rightMarkerText)}>
            {splitMarker(
              rightMarker,
              "flex h-full w-full items-center justify-center",
              "right",
            )}
          </div>
          <div className={cn("min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden px-3 py-0.5 text-xs leading-[22px]", rightTint)}>
            <TextLine
              line={rightLine || " "}
              combinedRev={combinedRev}
              hoverText={hoverText}
              showInline={getTextLineShowInline?.(settings)}
              findKind={findKind}
              findQuery={debouncedFindQuery}
              findMarkActive={findMarkActive}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-stretch", rowTint)} style={{ height: rowH }}>
      <div className="flex w-[4.5rem] shrink-0 select-none items-center border-r bg-muted/40 font-mono text-[11px] leading-none">
        <span className="flex w-10 shrink-0 items-center justify-end pr-1.5 text-right tabular-nums text-muted-foreground">
          {lineIndex + 1}
        </span>
        <span className={cn("h-full w-1 shrink-0", barColor)} aria-hidden />
        {gutterIcon && tooltipBody ? (
          <Tooltip>
            <TooltipTrigger render={iconTrigger} />
            <TooltipContent
              opaque
              side="right"
              className="max-w-sm whitespace-pre-line border border-zinc-800 bg-zinc-950 p-3 text-xs text-white"
            >
              {tooltipBody}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="flex w-5 shrink-0 items-center justify-center" aria-hidden>
            {gutterIcon}
          </span>
        )}
      </div>
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden px-3 py-0.5 text-xs leading-[22px]",
          lineType === "add" && "bg-green-500/20 dark:bg-green-500/14",
          lineType === "change" && "bg-amber-500/20 dark:bg-amber-500/14",
          lineType === "removed" && "bg-red-500/20 dark:bg-red-500/14",
        )}
      >
        <TextLine
          line={line}
          combinedRev={combinedRev}
          hoverText={hoverText}
          showInline={getTextLineShowInline?.(settings)}
          findKind={findKind}
          findQuery={debouncedFindQuery}
          findMarkActive={findMarkActive}
        />
      </div>
    </div>
  );
});

export function DiffConfigArchiveView({
  diffViewMode,
  combinedRev,
  baseRev,
  rev,
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
}: DiffConfigArchiveViewProps) {
  const searchParams = useSearchParams();
  const { selectedCacheType } = useCacheType();
  const selectedCacheTypeRef = React.useRef(selectedCacheType);
  selectedCacheTypeRef.current = selectedCacheType;
  const cacheTypeId = selectedCacheType.id;

  const { settings } = useSettings();
  const { loadGamevalType, hasLoaded, lookupGameval, getGamevalExtra } = useGamevals();
  const isCombined = diffViewMode === "combined";
  const isDiff = diffViewMode === "diff";
  const urlWantsText = isCombined && searchParams.get("view") === "text";
  const archiveGamevalRev = isCombined ? combinedRev : rev;

  const [viewMode, setViewMode] = React.useState<"text" | "table">(() =>
    diffViewMode === "combined" ? (urlWantsText ? "text" : "table") : "text",
  );
  const [diffLayout, setDiffLayout] = React.useState<"unified" | "split">("split");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState<number>(105);

  const [tableSearchMode, setTableSearchMode] = React.useState<DiffSearchFieldMode>(() =>
    pickDefaultArchiveTableSearchMode(combinedRev, tableSearch.disabledModes),
  );
  const [searchText, setSearchText] = React.useState("");
  const [gamevalTags, setGamevalTags] = React.useState<SearchTag[]>([]);
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

  const gamevalClientFilterActive =
    tableSearchMode === "gameval" && (gamevalTags.length > 0 || debouncedGamevalTextFragment.length > 0);

  /** Sprite-style id syntax (`10` matches `110`, `10+20` ranges, etc.) — server table API may not; bulk-fetch and filter client-side. */
  const syntaxDrivenClientTableActive =
    isCombined &&
    viewMode === "table" &&
    (tableSearchMode === "id" || tableSearchMode === "name" || tableSearchMode === "regex") &&
    debouncedTableQuery.trim().length > 0 &&
    looksLikeSpriteIdQueryText(debouncedTableQuery);

  React.useEffect(() => {
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
  }, [combinedRev]);

  React.useEffect(() => {
    if (tableSearchMode !== "gameval") setGamevalTags([]);
  }, [tableSearchMode]);

  React.useEffect(() => {
    if (isDiff) {
      setViewMode("text");
    } else if (isCombined) {
      setViewMode(urlWantsText ? "text" : "table");
    }
  }, [isDiff, isCombined, urlWantsText]);

  const disabledModesKey = tableSearch.disabledModes.join("\0");

  /** When the archive table identity or which modes exist changes, re-apply the default (prefer gameval when allowed). */
  React.useEffect(() => {
    setTableSearchMode(pickDefaultArchiveTableSearchMode(combinedRev, tableSearch.disabledModes));
    setPage(1);
    // combinedRev is read for pickDefault but omitted from deps so changing revision alone does not reset mode.
  }, [configType, disabledModesKey]);

  React.useEffect(() => {
    if (!tableSearch.disabledModes.includes(tableSearchMode)) return;
    const next =
      (["gameval", "id", "name", "regex"] as const).find((m) => !tableSearch.disabledModes.includes(m)) ?? "id";
    setTableSearchMode(next);
  }, [disabledModesKey, tableSearch.disabledModes, tableSearchMode]);

  const [tableRows, setTableRows] = React.useState<ConfigArchiveTableRow[]>([]);
  const [tableTotal, setTableTotal] = React.useState(0);
  const [tableStatus, setTableStatus] = React.useState<"idle" | "loading" | "ok" | "error" | "decoding">("idle");
  const [tableError, setTableError] = React.useState<string | null>(null);

  const [contentLines, setContentLines] = React.useState<ConfigLine[]>([]);
  const [contentStatus, setContentStatus] = React.useState<
    "idle" | "loading" | "ok" | "error" | "decoding"
  >("idle");
  const [contentError, setContentError] = React.useState<string | null>(null);

  const [textFindQuery, setTextFindQuery] = React.useState("");
  const [archiveDiffLineFilter, setArchiveDiffLineFilter] = React.useState<ConfigFilterMode>("all");
  const debouncedTextFindQuery = useDebouncedValue(textFindQuery, textFindDebounceMs);
  const [textFindKind, setTextFindKind] = React.useState<"literal" | "regex">("literal");
  const [textFindActiveIdx, setTextFindActiveIdx] = React.useState(0);
  const textScrollRef = React.useRef<HTMLDivElement | null>(null);
  const textVirtRafRef = React.useRef<number | null>(null);
  const textVirtPendingRef = React.useRef({ scrollTop: 0, clientHeight: 400 });
  const [textVirt, setTextVirt] = React.useState({ scrollTop: 0, clientHeight: 400 });

  const onTextScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    textVirtPendingRef.current = { scrollTop: el.scrollTop, clientHeight: el.clientHeight };
    if (textVirtRafRef.current != null) return;
    textVirtRafRef.current = window.requestAnimationFrame(() => {
      textVirtRafRef.current = null;
      const p = textVirtPendingRef.current;
      setTextVirt({ scrollTop: p.scrollTop, clientHeight: p.clientHeight });
    });
  }, []);

  React.useEffect(() => {
    if (!isDiff) setArchiveDiffLineFilter("all");
  }, [isDiff]);

  React.useEffect(() => {
    if (!isDiff || viewMode !== "text") return;
    const el = textScrollRef.current;
    if (el) el.scrollTop = 0;
  }, [archiveDiffLineFilter, isDiff, viewMode]);

  React.useEffect(() => {
    return () => {
      if (textVirtRafRef.current != null) {
        window.cancelAnimationFrame(textVirtRafRef.current);
        textVirtRafRef.current = null;
      }
    };
  }, []);

  const [combinedSpriteIds, setCombinedSpriteIds] = React.useState<number[] | null>(null);
  const tableRequestRef = React.useRef(0);
  const gamevalBulkRequestRef = React.useRef(0);
  const syntaxBulkRequestRef = React.useRef(0);
  const contentRequestRef = React.useRef(0);
  const combinedSpritesRequestRef = React.useRef(0);

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
  const gamevalAutocompleteType = gamevalAutocomplete?.type ?? null;
  const tableSearchIndexRequestRef = React.useRef(0);

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

  const indexedQueryActive =
    isCombined &&
    viewMode === "table" &&
    ((tableSearchMode === "gameval" && (gamevalTags.length > 0 || debouncedGamevalTextFragment.length > 0)) ||
      ((tableSearchMode === "id" || tableSearchMode === "name" || tableSearchMode === "regex") &&
        debouncedTableQuery.trim().length > 0));

  React.useEffect(() => {
    if (!isCombined || viewMode !== "table" || !tableSearchIndexCacheKey) {
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
        const allRows: ConfigArchiveTableRow[] = [];
        const etags: string[] = [];
        let offset = 0;
        let serverTotal = Number.POSITIVE_INFINITY;

        while (offset < serverTotal) {
          if (requestId !== tableSearchIndexRequestRef.current) return;

          const url = diffConfigTableUrl(configType, {
            base: tableBase,
            rev: combinedRev,
            offset,
            limit: bulkPageSize,
            q: undefined,
            mode: "id",
          });
          const cacheKey = `diff:config:table:${cacheTypeId}:${url}`;
          const { data, etag } = await conditionalJsonFetch<Record<string, unknown>>(cacheKey, url, {
            headers: cacheProxyHeaders(selectedCacheTypeRef.current),
          });

          if (requestId !== tableSearchIndexRequestRef.current) return;

          const parsed = parseConfigTablePayload(data as Record<string, unknown>);
          if (parsed.decoding) {
            setTableSearchIndex(null);
            setTableSearchIndexStatus("idle");
            return;
          }

          serverTotal = parsed.total;
          allRows.push(...parsed.rows);
          etags.push(etag ?? `offset:${offset}:count:${parsed.rows.length}`);
          if (parsed.rows.length === 0 || parsed.rows.length < bulkPageSize) break;
          offset += bulkPageSize;
        }

        const nextIndex = buildConfigArchiveTableSearchIndex(allRows, {
          combinedRev,
          sourceFingerprint: etags.join("|"),
          gamevalBulkFilter: gvReadyForBulk ? gamevalBulkFilterRef.current : null,
          lookupGameval,
          getGamevalExtra,
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
    tableSearchIndexCacheKey,
    configType,
    tableBase,
    combinedRev,
    bulkPageSize,
    cacheTypeId,
    lookupGameval,
    getGamevalExtra,
    labels.tableEntityPlural,
    gvReadyForBulk,
  ]);

  const indexedFilteredRows = React.useMemo(() => {
    if (!indexedQueryActive || !tableSearchIndex) return null;
    return searchConfigArchiveTableIndex(tableSearchIndex, {
      mode: tableSearchMode,
      tableQuery: debouncedTableQuery,
      gamevalTags,
      gamevalTextFragment: debouncedGamevalTextFragment,
    });
  }, [
    indexedQueryActive,
    tableSearchIndex,
    tableSearchMode,
    debouncedTableQuery,
    gamevalTags,
    debouncedGamevalTextFragment,
  ]);

  const indexedClientPageActive =
    viewMode === "table" && indexedQueryActive && indexedFilteredRows !== null && tableSearchIndexStatus === "ready";

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
        const url = combinedSpritesUrl(combinedRev, tableBase);
        const cacheKey = `diff:combined:sprites:${cacheTypeId}:${tableBase}:${combinedRev}`;
        const { data } = await conditionalJsonFetch<Record<string, unknown>>(cacheKey, url, {
          headers: cacheProxyHeaders(selectedCacheTypeRef.current),
        });

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

    const requestId = ++tableRequestRef.current;
    setTableStatus("loading");
    setTableError(null);
    setClientFilteredRows(null);
    setClientFetchStatus("idle");
    setClientFetchError(null);

    const offset = (page - 1) * perPage;
    const serverMode = tableSearchMode === "gameval" ? "id" : tableSearchMode;
    const serverQ =
      (tableSearchMode === "id" || tableSearchMode === "name" || tableSearchMode === "regex") &&
      debouncedTableQuery.length > 0
        ? debouncedTableQuery
        : undefined;

    const run = async () => {
      try {
        const url = diffConfigTableUrl(configType, {
          base: tableBase,
          rev: combinedRev,
          offset,
          limit: perPage,
          q: serverQ,
          mode: serverMode,
        });
        const cacheKey = `diff:config:table:${cacheTypeId}:${url}`;
        const { data } = await conditionalJsonFetch<Record<string, unknown>>(cacheKey, url, {
          headers: cacheProxyHeaders(selectedCacheTypeRef.current),
        });

        if (requestId !== tableRequestRef.current) return;

        const dataRecord = data as Record<string, unknown>;

        const parsed = parseConfigTablePayload(dataRecord);
        if (parsed.decoding) {
          setTableRows([]);
          setTableTotal(0);
          setTableStatus("decoding");
          return;
        }

        setTableRows(parsed.rows);
        setTableTotal(parsed.total);
        setTableStatus("ok");
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

          const url = diffConfigTableUrl(configType, {
            base: tableBase,
            rev: combinedRev,
            offset,
            limit: pageSize,
            q: undefined,
            mode: "id",
          });
          const cacheKey = `diff:config:table:${cacheTypeId}:${url}`;
          const { data } = await conditionalJsonFetch<Record<string, unknown>>(cacheKey, url, {
            headers: cacheProxyHeaders(selectedCacheTypeRef.current),
          });

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

          const url = diffConfigTableUrl(configType, {
            base: tableBase,
            rev: combinedRev,
            offset,
            limit: bulkPageSize,
            q: undefined,
            mode: "id",
          });
          const cacheKey = `diff:config:table:${cacheTypeId}:${url}`;
          const { data } = await conditionalJsonFetch<Record<string, unknown>>(cacheKey, url, {
            headers: cacheProxyHeaders(selectedCacheTypeRef.current),
          });

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

  React.useEffect(() => {
    const wantsText = viewMode === "text";
    if (!wantsText || (!isCombined && !isDiff)) return;

    const requestId = ++contentRequestRef.current;
    setContentStatus("loading");
    setContentError(null);

    const run = async () => {
      try {
        let url: string;
        let cacheKey: string;
        if (isDiff) {
          const o = diffCacheOrderedPair(baseRev, rev);
          url = diffConfigContentUrl(configType, o);
          cacheKey = `diff:config:content:${cacheTypeId}:${configType}:pair:${o.base}:${o.rev}`;
        } else {
          const search = new URLSearchParams({ type: configType === "spotanim" ? "spotanims" : configType, rev: String(combinedRev) });
          url = `/api/cache-proxy/cache?${search.toString()}`;
          cacheKey = `cache:config:content:${cacheTypeId}:${configType}:${combinedRev}`;
        }
        const { data } = await conditionalJsonFetch<unknown>(cacheKey, url, {
          headers: cacheProxyHeaders(selectedCacheTypeRef.current),
        });

        if (requestId !== contentRequestRef.current) return;

        const dataUnknown: unknown = data;
        const linesResult = isDiff
          ? configLinesFromContentPayload(dataUnknown)
          : configLinesFromCachePayload(dataUnknown, configType, {
              headerLabelForId:
                headerGamevalType && combinedRev >= GAMEVAL_MIN_REVISION
                  ? (id) => lookupGameval(headerGamevalType, id, combinedRev)
                  : undefined,
              includeCommentWithoutHeaderLabel: false,
            });
        if (linesResult === null) {
          setContentLines([]);
          setContentStatus("decoding");
          return;
        }
        setContentLines(linesResult);
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
    headerGamevalType,
    lookupGameval,
  ]);

  const textFindMatcher = React.useMemo(():
    | { mode: "empty" }
    | { mode: "bad"; error: string }
    | { mode: "ok"; test: (line: string) => boolean } => {
    const q = debouncedTextFindQuery.trim();
    if (!q) return { mode: "empty" };
    if (textFindKind === "literal") {
      const lower = q.toLowerCase();
      return {
        mode: "ok",
        test: (line: string) => line.toLowerCase().includes(lower),
      };
    }
    try {
      const re = new RegExp(q, "i");
      return {
        mode: "ok",
        test: (line: string) => {
          try {
            re.lastIndex = 0;
            return re.test(line);
          } catch {
            return false;
          }
        },
      };
    } catch (e) {
      return {
        mode: "bad",
        error: e instanceof Error ? e.message : "Invalid regular expression",
      };
    }
  }, [debouncedTextFindQuery, textFindKind]);

  const textRegexErrorImmediate = React.useMemo(() => {
    if (textFindKind !== "regex") return null;
    const q = textFindQuery.trim();
    if (!q) return null;
    try {
      new RegExp(q);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid regular expression";
    }
  }, [textFindKind, textFindQuery]);

  const textFindDisplayedError = textFindKind === "regex" ? textRegexErrorImmediate : null;

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

  const textLineNumbersByIndex = React.useMemo(() => {
    const out: { oldLine: number | null; newLine: number | null }[] = [];
    let oldLine = 1;
    let newLine = 1;
    for (let i = 0; i < contentLines.length; i++) {
      const kind = textLineKindByIndex[i] ?? "context";
      if (kind === "add") {
        out[i] = { oldLine: null, newLine };
        newLine++;
      } else if (kind === "removed") {
        out[i] = { oldLine, newLine: null };
        oldLine++;
      } else {
        out[i] = { oldLine, newLine };
        oldLine++;
        newLine++;
      }
    }
    return out;
  }, [contentLines, textLineKindByIndex]);

  const textLineDisplayIndices = React.useMemo(() => {
    if (viewMode !== "text") return [];
    if (!isDiff) return contentLines.map((_, i) => i);

    const bodyVisible = new Array<boolean>(contentLines.length).fill(false);
    const wantKind =
      archiveDiffLineFilter === "added"
        ? "add"
        : archiveDiffLineFilter === "removed"
          ? "removed"
          : archiveDiffLineFilter === "changed"
            ? "change"
            : null;
    if (wantKind === null) {
      bodyVisible.fill(true);
    } else {
      for (let i = 0; i < contentLines.length; i++) {
        const row = contentLines[i]!;
        if (row.line.startsWith("// ") || isBracketSectionTitleLine(contentLines, i)) continue;
        const kind = textLineKindByIndex[i] ?? "context";
        bodyVisible[i] = wantKind === "change" ? row.type === "change" : kind === wantKind;
      }
    }

    const sectionVisible = new Array<boolean>(contentLines.length).fill(false);
    let sectionStart = -1;
    let hasVisibleBody = false;
    const flushSection = (endExclusive: number) => {
      if (sectionStart < 0) return;
      sectionVisible[sectionStart] = hasVisibleBody;
      const titleIdx = sectionStart + 1;
      if (titleIdx < endExclusive && isBracketSectionTitleLine(contentLines, titleIdx)) {
        sectionVisible[titleIdx] = hasVisibleBody;
      }
    };
    for (let i = 0; i <= contentLines.length; i++) {
      const isHeader = i < contentLines.length && contentLines[i]!.line.startsWith("// ");
      if (isHeader || i === contentLines.length) {
        flushSection(i);
        sectionStart = i < contentLines.length ? i : -1;
        hasVisibleBody = false;
        continue;
      }
      if (sectionStart >= 0 && bodyVisible[i]) hasVisibleBody = true;
    }

    const out: number[] = [];
    for (let i = 0; i < contentLines.length; i++) {
      if (bodyVisible[i] || sectionVisible[i]) out.push(i);
    }
    return out;
  }, [viewMode, isDiff, contentLines, archiveDiffLineFilter, textLineKindByIndex]);

  const textDisplayPositionBySourceIndex = React.useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 0; i < textLineDisplayIndices.length; i++) {
      map.set(textLineDisplayIndices[i]!, i);
    }
    return map;
  }, [textLineDisplayIndices]);

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

  const textVirtualWindow = React.useMemo(() => {
    if (viewMode !== "text") {
      return { start: 0, end: 0, topPx: 0, totalLines: 0, rowH: resolvedTextRowHeight };
    }
    const total = textLineDisplayIndices.length;
    const rowH = resolvedTextRowHeight;
    if (total === 0) return { start: 0, end: 0, topPx: 0, totalLines: 0, rowH: resolvedTextRowHeight };
    const { scrollTop, clientHeight } = textVirt;
    const ch = Math.max(clientHeight, 1);
    const start = Math.max(0, Math.floor(scrollTop / rowH) - textOverscan);
    const end = Math.min(total, Math.ceil((scrollTop + ch) / rowH) + textOverscan);
    return { start, end, topPx: start * rowH, totalLines: total, rowH };
  }, [viewMode, textLineDisplayIndices, textVirt, resolvedTextRowHeight, textOverscan]);

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
    const rowH = resolvedTextRowHeight;
    const displayPos = textDisplayPositionBySourceIndex.get(activeTextLineIndex);
    if (displayPos == null) return;
    const rowTop = displayPos * rowH;
    const viewTop = root.scrollTop;
    const viewH = root.clientHeight;
    const pad = 8;
    if (rowTop < viewTop + pad) {
      root.scrollTop = Math.max(0, rowTop - pad);
    } else if (rowTop + rowH > viewTop + viewH - pad) {
      root.scrollTop = rowTop - viewH + rowH + pad;
    }
  }, [viewMode, activeTextLineIndex, textFindActiveIdx, resolvedTextRowHeight, textDisplayPositionBySourceIndex]);

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

  const displayTotal =
    viewMode === "table" && clientSidePagination
      ? indexedClientPageActive
        ? indexedFilteredRows!.length
        : clientPageActive
          ? clientFilteredRows!.length
        : 0
      : tableTotal;

  const totalPages = Math.max(1, Math.ceil(displayTotal / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const displayRows =
    viewMode === "table" && clientSidePagination
      ? indexedClientPageActive
        ? indexedFilteredRows!.slice((safePage - 1) * perPage, safePage * perPage)
        : clientPageActive
          ? clientFilteredRows!.slice((safePage - 1) * perPage, safePage * perPage)
        : []
      : tableRows;

  const tablePlan = buildTablePlan({ displayRows, combinedRev });

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

  const textFindHasMatches = textMatchIndices.length > 0;
  const textFindHasQuery = textFindQuery.trim().length > 0;
  const textFindNavDisabled =
    !textFindHasQuery ||
    Boolean(textRegexErrorImmediate) ||
    !textFindHasMatches ||
    textFindMatcher.mode === "bad" ||
    textFindMatcher.mode === "empty";

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

  const findErrorId = `archive-text-find-error-${configType}`;

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
            : "Search the raw config: String = case-insensitive substring. Regex = JavaScript-style pattern (case-insensitive). Enter = next match, Shift+Enter = previous."
        }
        countLabel={headerCountLabel}
        trailing={
          isCombined ? (
            <DiffViewModeToggle
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "table", label: "Table" },
                { value: "text", label: "Text" },
              ]}
            />
          ) : isDiff ? (
            <DiffViewModeToggle
              value={diffLayout}
              onChange={setDiffLayout}
              options={[
                { value: "unified", label: "Unified" },
                { value: "split", label: "Split" },
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
      {isCombined && viewMode === "table" && tableStatus === "decoding" ? (
        <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {labels.decodingMessage}
        </p>
      ) : null}
      {viewMode === "text" && contentStatus === "decoding" ? (
        <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {labels.decodingMessage}
        </p>
      ) : null}
      {viewMode === "text" && contentStatus === "error" && contentError ? (
        <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {contentError}
        </p>
      ) : null}

      {isCombined && viewMode === "table" ? (
        <div className={DIFF_COMBINED_SEARCH_WRAP_CLASS}>
          <DiffUnifiedSearchField
            mode={tableSearchMode}
            onModeChange={setTableSearchMode}
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
      ) : (
        <div className="mb-3 flex w-full min-w-0 max-w-full flex-wrap items-start gap-2">
          {isDiff ? (
            <OptionDropdown
              className="w-[8.5rem] shrink-0"
              ariaLabel="Config line change filter"
              value={archiveDiffLineFilter}
              options={[
                { value: "all", label: "All" },
                { value: "added", label: "Added" },
                { value: "changed", label: "Changed" },
                { value: "removed", label: "Removed" },
              ]}
              onChange={(v) => setArchiveDiffLineFilter(v as ConfigFilterMode)}
            />
          ) : null}
          <div className="relative z-[70] flex min-w-0 max-w-full flex-initial flex-col gap-1.5">
            <div
              className={cn(
                "relative z-50 flex h-8 min-w-0 max-w-full flex-nowrap items-stretch rounded-md border border-border bg-muted/25 shadow-sm",
                "dark:bg-muted/20",
              )}
            >
              <label className="flex min-h-0 w-[min(13rem,100%)] shrink cursor-text items-center gap-2 pl-2 pr-0.5 sm:w-[min(14rem,100%)]">
                <span className="sr-only">Find in config text</span>
                <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  type="text"
                  value={textFindQuery}
                  onChange={(e) => setTextFindQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (e.shiftKey) {
                        if (!textFindNavDisabled) {
                          const n = textMatchIndices.length;
                          setTextFindActiveIdx((i) => (i - 1 + n) % n);
                        }
                      } else if (!textFindNavDisabled) {
                        const n = textMatchIndices.length;
                        setTextFindActiveIdx((i) => (i + 1) % n);
                      }
                    }
                  }}
                  placeholder={textFindKind === "regex" ? "Regex…" : "Find…"}
                  aria-invalid={textFindDisplayedError != null}
                  aria-describedby={textFindDisplayedError ? findErrorId : undefined}
                  className={cn(
                    "min-h-0 min-w-0 w-full bg-transparent py-1 font-mono text-xs text-foreground outline-none",
                    "placeholder:text-muted-foreground",
                  )}
                />
              </label>

              <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />

              <div className="flex h-full shrink-0 items-center px-1">
                <div
                  className="flex h-6 items-stretch gap-0.5 rounded border border-border bg-background/95 p-px shadow-sm dark:bg-background/50"
                  role="group"
                  aria-label="Search mode"
                >
                  <button
                    type="button"
                    aria-pressed={textFindKind === "literal"}
                    className={cn(
                      "min-w-[3.25rem] rounded-sm px-1.5 text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      textFindKind === "literal"
                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                    onClick={() => setTextFindKind("literal")}
                  >
                    String
                  </button>
                  <button
                    type="button"
                    aria-pressed={textFindKind === "regex"}
                    className={cn(
                      "min-w-[3.25rem] rounded-sm px-1.5 text-xs font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      textFindKind === "regex"
                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                    onClick={() => setTextFindKind("regex")}
                  >
                    Regex
                  </button>
                </div>
              </div>

              <div className="flex shrink-0 flex-nowrap items-stretch" aria-label="Match navigation">
                <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />
                <div className="flex h-full w-8 shrink-0 flex-col divide-y divide-border">
                  <button
                    type="button"
                    title="Previous match (Shift+Enter)"
                    aria-label="Previous match"
                    disabled={textFindNavDisabled}
                    className={cn(
                      "flex min-h-0 flex-1 items-center justify-center border-0 bg-muted/50 text-foreground",
                      "hover:bg-muted/80 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      "dark:bg-muted/35 dark:hover:bg-muted/55",
                      "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
                    )}
                    onClick={() => {
                      const n = textMatchIndices.length;
                      setTextFindActiveIdx((i) => (i - 1 + n) % n);
                    }}
                  >
                    <ChevronUp className="size-3 shrink-0 opacity-80" aria-hidden />
                  </button>
                  <button
                    type="button"
                    title="Next match (Enter)"
                    aria-label="Next match"
                    disabled={textFindNavDisabled}
                    className={cn(
                      "flex min-h-0 flex-1 items-center justify-center border-0 bg-muted/50 text-foreground",
                      "hover:bg-muted/80 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      "dark:bg-muted/35 dark:hover:bg-muted/55",
                      "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
                    )}
                    onClick={() => {
                      const n = textMatchIndices.length;
                      setTextFindActiveIdx((i) => (i + 1) % n);
                    }}
                  >
                    <ChevronDown className="size-3 shrink-0 opacity-80" aria-hidden />
                  </button>
                </div>
                <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />
                <div
                  className={cn(
                    "flex h-full min-w-[4.75rem] shrink-0 items-center justify-center bg-muted/50 px-1 text-[11px] leading-none tabular-nums text-muted-foreground",
                    "dark:bg-muted/35",
                    textFindNavDisabled && "opacity-40",
                  )}
                  aria-live="polite"
                  aria-label={
                    textFindNavDisabled
                      ? "Match count unavailable"
                      : `Match ${textFindActiveIdx + 1} of ${textMatchIndices.length}`
                  }
                >
                  {textFindMatcher.mode === "bad"
                    ? "—"
                    : textFindHasMatches
                      ? `${textFindActiveIdx + 1}/${textMatchIndices.length}`
                      : "—"}
                </div>
              </div>
            </div>
            {textFindHasQuery && textFindDisplayedError ? (
              <p id={findErrorId} className="text-xs text-destructive">
                {textFindDisplayedError}
              </p>
            ) : null}
          </div>
          {isDiff ? (
            <div className="ml-auto hidden h-8 shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/35 px-2 text-[11px] text-muted-foreground lg:flex">
              <span className="font-mono text-amber-700 dark:text-amber-400">~</span>
              <span>changed</span>
              <span className="mx-0.5 text-border">|</span>
              <span className="font-mono text-green-700 dark:text-green-400">+</span>
              <span>added</span>
              <span className="mx-0.5 text-border">|</span>
              <span className="font-mono text-red-700 dark:text-red-400">-</span>
              <span>removed</span>
            </div>
          ) : null}
        </div>
      )}

      {isCombined && viewMode === "table" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {contentStatus === "loading" ? (
            <div
              className="flex min-h-0 flex-1 items-center justify-center rounded-md border bg-background p-6"
              aria-busy="true"
              aria-label="Loading config text"
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">Loading config text...</p>
              </div>
            </div>
          ) : (
            <div
              ref={textScrollRef}
              onScroll={onTextScroll}
              className="min-h-0 flex-1 overflow-auto rounded-md border bg-background"
            >
              <div
                className="relative font-mono text-xs"
                style={{ height: textVirtualWindow.totalLines * textVirtualWindow.rowH }}
              >
                {textVirtualWindow.totalLines === 0 ? (
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
                    {textLineDisplayIndices
                      .slice(textVirtualWindow.start, textVirtualWindow.end)
                      .map((sourceLineIndex) => {
                        const i = sourceLineIndex;
                        const row = contentLines[i]!;
                        const kind = textLineKindByIndex[i] ?? row.type;
                        const nums = textLineNumbersByIndex[i] ?? { oldLine: null, newLine: null };
                        const debouncedQ = debouncedTextFindQuery.trim();
                        const findOk = textFindMatcher.mode === "ok";
                        const rowH = textVirtualWindow.rowH;
                        return (
                          <ConfigArchiveVirtualTextRow
                            key={i}
                            lineIndex={i}
                            line={row.line}
                            hoverText={row.hoverText}
                            oldLineNumber={nums.oldLine}
                            newLineNumber={nums.newLine}
                            lineType={isDiff ? kind : "context"}
                            addedInRev={row.addedInRev}
                            changedInRev={row.changedInRev}
                            removedInRev={row.removedInRev}
                            before={row.before}
                            layout={isDiff ? diffLayout : "unified"}
                            rowH={rowH}
                            combinedRev={archiveGamevalRev}
                            debouncedFindQuery={debouncedQ}
                            findKind={textFindKind}
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
            </div>
          )}
        </div>
      )}
    </>
  );
}
