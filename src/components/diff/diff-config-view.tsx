"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCacheType } from "@/context/cache-type-context";
import type { GamevalType } from "@/context/gameval-context";
import type { AppSettings } from "@/context/settings-context";
import { useSettings } from "@/context/settings-context";
import { DiffDecodeProgressBanner } from "@/components/diff/diff-decode-progress";
import { diffCacheOrderedPair, diffConfigContentUrl } from "@/lib/cache-api-client";
import {
  conditionalJsonFetchAwaitingDecode,
  isDiffDecodePayload,
  type DiffDecodeProgress,
} from "@/lib/diff-decode";
import { onCopyApplyGamevalUppercaseSetting } from "@/lib/gameval-clipboard";
import { cn } from "@/lib/utils";

import {
  CONFIG_DIFF_LINES,
  CONFIG_FULL_ROWS,
  CONFIG_TYPES,
  DIFF_COMBINED_SEARCH_WRAP_CLASS,
  GAMEVAL_MIN_REVISION,
  sectionGamevalTypeForSection,
} from "./diff-constants";
import { configLinesFromDiffBody } from "./diff-config-content";
import { ColorLineText, DiffConfigDiffText } from "./diff-config-diff-text";
import { useDiffExplorerFocus } from "./diff-explorer-focus";
import { parseFocusEntityId, bareFocusTitle } from "./diff-focus-match";
import { DiffArchiveTable } from "./diff-archive-table";
import { idQueryMatchesNumericId, looksLikeSpriteIdQueryText } from "./diff-id-search";
import { openruneColumnHeaderLabel } from "./diff-openrune-archive-columns";
import { diffSearchModeTooltipHelp } from "./diff-search-modes";
import { DiffSearchToolbar } from "./diff-search-toolbar";
import { DiffSectionHeader } from "./diff-section-header";
import { useDiffTextLayoutOptional } from "./diff-text-layout";
import { DiffUnifiedSearchField } from "./diff-unified-search-field";
import { DiffViewModeToggle } from "./diff-view-mode-toggle";
import {
  DIFF_ARCHIVE_TABLE_CELL_CLASS,
  DIFF_ARCHIVE_TABLE_HEAD_CLASS,
  DIFF_ARCHIVE_TABLE_HEADER_CLASS,
  DIFF_ARCHIVE_TABLE_ROW_CLASS,
} from "./diff-table-archive-styles";
import type { ConfigLine, DiffMode, DiffSearchFieldMode, SearchTag, Section } from "./diff-types";

function normalizeRemoteConfigLines(payload: unknown): ConfigLine[] {
  return configLinesFromDiffBody(payload);
}

function configSectionGamevalType(section: Section): GamevalType | null {
  return sectionGamevalTypeForSection(section);
}

function configStaticRowsIncludeGamevalColumn(section: Section): boolean {
  const rows = CONFIG_FULL_ROWS[section] ?? [];
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(row.entries, "gameval")) return true;
  }
  return false;
}

function configGamevalSuggestionSettingsEnabled(
  section: Section,
  display: AppSettings["suggestionDisplay"],
): boolean {
  const gamevalType = configSectionGamevalType(section);
  if (!gamevalType) return false;
  switch (gamevalType.toLowerCase()) {
    case "items":
      return display.items;
    case "npcs":
      return display.npcs;
    case "objects":
      return display.objects;
    case "sequences":
      return display.sequences;
    case "spotanims":
      return display.spotanims;
    case "inv":
      return display.objects;
    default:
      // Unknown/new gameval type from API: enable suggestions by default.
      return true;
  }
}

type DiffConfigViewProps = {
  section: Section;
  sectionLabel?: string;
  diffViewMode: DiffMode;
  combinedRev: number;
  baseRev: number;
  rev: number;
  /** Diff explorer Full: text only (no table toggle). */
  textOnly?: boolean;
};

export function DiffConfigView({
  section,
  sectionLabel,
  diffViewMode,
  combinedRev,
  baseRev,
  rev,
  textOnly = false,
}: DiffConfigViewProps) {
  const searchParams = useSearchParams();
  const { settings } = useSettings();
  const { selectedCacheType } = useCacheType();
  const urlWantsTable = diffViewMode === "combined" && searchParams.get("view") === "table";
  const [configViewMode, setConfigViewMode] = React.useState<"text" | "table">(() =>
    textOnly || diffViewMode === "diff" ? "text" : urlWantsTable ? "table" : "text",
  );
  const textLayoutCtx = useDiffTextLayoutOptional();
  const diffLayout = textLayoutCtx?.diffLayout ?? "split";
  const [configTableSearchMode, setConfigTableSearchMode] = React.useState<DiffSearchFieldMode>(() => {
    if (combinedRev < GAMEVAL_MIN_REVISION) return "id";
    return configStaticRowsIncludeGamevalColumn(section) ? "gameval" : "id";
  });
  const [configSearchQuery, setConfigSearchQuery] = React.useState("");
  const [configGamevalTags, setConfigGamevalTags] = React.useState<SearchTag[]>([]);
  const prevCombinedGamevalSupportedRef = React.useRef(combinedRev >= GAMEVAL_MIN_REVISION);
  const prevSectionRef = React.useRef<Section | null>(null);
  const configSearchInputRef = React.useRef<HTMLInputElement | null>(null);
  const { focusBracketTitle, focusNonce } = useDiffExplorerFocus();

  const [remoteDiffLines, setRemoteDiffLines] = React.useState<ConfigLine[] | null>(null);
  const [remoteDiffStatus, setRemoteDiffStatus] = React.useState<"idle" | "loading" | "ok" | "error" | "decoding">(
    "idle",
  );
  const [remoteDiffError, setRemoteDiffError] = React.useState<string | null>(null);
  const [decodeProgress, setDecodeProgress] = React.useState<DiffDecodeProgress | null>(null);
  const diffFetchRef = React.useRef(0);

  const fetchableDiffSection = (CONFIG_TYPES as readonly string[]).includes(section);
  const liveDiffText = diffViewMode === "diff" && fetchableDiffSection;

  React.useEffect(() => {
    if (diffViewMode === "diff" || textOnly) {
      setConfigViewMode("text");
    } else {
      setConfigViewMode(urlWantsTable ? "table" : "text");
    }
  }, [diffViewMode, textOnly, urlWantsTable]);

  React.useEffect(() => {
    if (!focusNonce || !focusBracketTitle) return;
    // Prefer bare id for `// 33428`; otherwise use gameval / title text.
    const id = parseFocusEntityId(focusBracketTitle);
    setConfigSearchQuery(id != null ? String(id) : bareFocusTitle(focusBracketTitle));
    setConfigViewMode("text");
  }, [focusBracketTitle, focusNonce]);

  React.useEffect(() => {
    if (!liveDiffText) {
      setRemoteDiffLines(null);
      setRemoteDiffStatus("idle");
      setRemoteDiffError(null);
      setDecodeProgress(null);
      return;
    }

    if (baseRev === rev) {
      setRemoteDiffLines([]);
      setRemoteDiffStatus("ok");
      setRemoteDiffError(null);
      setDecodeProgress(null);
      return;
    }

    const requestId = ++diffFetchRef.current;
    const ac = new AbortController();
    setRemoteDiffStatus("loading");
    setRemoteDiffError(null);
    setDecodeProgress(null);

    const pair = diffCacheOrderedPair(baseRev, rev);
    const url = diffConfigContentUrl(selectedCacheType, section, pair);
    const cacheKey = `diff:config:content:${selectedCacheType.id}:${section}:${pair.base}:${pair.rev}`;

    void (async () => {
      try {
        const { data: raw } = await conditionalJsonFetchAwaitingDecode<unknown>(cacheKey, url, {
          cacheType: selectedCacheType,
          signal: ac.signal,
          onProgress: (progress) => {
            if (requestId !== diffFetchRef.current) return;
            setDecodeProgress(progress);
            setRemoteDiffStatus("decoding");
          },
        });
        if (requestId !== diffFetchRef.current) return;
        if (isDiffDecodePayload(raw)) {
          setRemoteDiffLines([]);
          setRemoteDiffStatus("decoding");
          return;
        }
        setRemoteDiffLines(normalizeRemoteConfigLines(raw));
        setDecodeProgress(null);
        setRemoteDiffStatus("ok");
      } catch (e) {
        if (ac.signal.aborted || requestId !== diffFetchRef.current) return;
        setRemoteDiffLines(null);
        setDecodeProgress(null);
        setRemoteDiffStatus("error");
        setRemoteDiffError(e instanceof Error ? e.message : "Failed to load config diff");
      }
    })();

    return () => ac.abort();
  }, [liveDiffText, section, baseRev, rev, selectedCacheType, fetchableDiffSection]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!liveDiffText) return;
      if (!e.ctrlKey || e.key !== "f") return;
      e.preventDefault();
      configSearchInputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [liveDiffText]);

  const sectionRows = CONFIG_FULL_ROWS[section] ?? [];

  React.useEffect(() => {
    const supported = combinedRev >= GAMEVAL_MIN_REVISION;
    const prev = prevCombinedGamevalSupportedRef.current;
    prevCombinedGamevalSupportedRef.current = supported;
    if (!supported) {
      setConfigTableSearchMode((m) => (m === "gameval" ? "id" : m));
      setConfigGamevalTags([]);
      return;
    }
    if (!prev && supported && configStaticRowsIncludeGamevalColumn(section)) {
      setConfigTableSearchMode((m) => (m === "id" ? "gameval" : m));
    }
  }, [combinedRev, section]);

  React.useEffect(() => {
    if (configTableSearchMode !== "gameval") setConfigGamevalTags([]);
  }, [configTableSearchMode]);

  React.useEffect(() => {
    if (prevSectionRef.current === section) return;
    prevSectionRef.current = section;
    setConfigSearchQuery("");
    setConfigGamevalTags([]);
    if (combinedRev >= GAMEVAL_MIN_REVISION && configStaticRowsIncludeGamevalColumn(section)) {
      setConfigTableSearchMode("gameval");
    } else {
      setConfigTableSearchMode("id");
    }
  }, [section, combinedRev]);

  const visibleSectionRows = React.useMemo(() => {
    const rows = sectionRows;

    if (configTableSearchMode === "id") {
      const q = configSearchQuery.trim();
      if (!q) return rows;
      return rows.filter((row) => idQueryMatchesNumericId(row.id, configSearchQuery));
    }

    if (configTableSearchMode === "name") {
      const q = configSearchQuery.trim().toLowerCase();
      const raw = configSearchQuery;
      if (!q) return rows;
      return rows.filter((row) => {
        const nameMatch = (row.entries.name ?? "").toLowerCase().includes(q);
        if (looksLikeSpriteIdQueryText(raw)) {
          return nameMatch || idQueryMatchesNumericId(row.id, raw);
        }
        return nameMatch;
      });
    }

    if (configGamevalTags.length > 0) {
      const tagFiltered = rows.filter((row) =>
        configGamevalTags.every((tag) => {
          const needle = tag.value.trim().toLowerCase();
          if (!needle) return true;
          const gv = (row.entries.gameval ?? "").toLowerCase();
          const nm = (row.entries.name ?? "").toLowerCase();
          if (tag.exact) return gv === needle || nm === needle;
          return gv.includes(needle) || nm.includes(needle);
        }),
      );
      const t = configSearchQuery.trim();
      if (t && looksLikeSpriteIdQueryText(configSearchQuery)) {
        return tagFiltered.filter((row) => idQueryMatchesNumericId(row.id, configSearchQuery));
      }
      return tagFiltered;
    }

    const q = configSearchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const gv = (row.entries.gameval ?? "").toLowerCase();
      const nm = (row.entries.name ?? "").toLowerCase();
      const text = gv.includes(q) || nm.includes(q);
      if (looksLikeSpriteIdQueryText(configSearchQuery)) {
        return text || idQueryMatchesNumericId(row.id, configSearchQuery);
      }
      return text;
    });
  }, [sectionRows, configSearchQuery, configTableSearchMode, configGamevalTags]);

  const staticDiffLines = CONFIG_DIFF_LINES[section] ?? [];

  const fallbackDiffLines = React.useMemo(() => {
    const q = configSearchQuery.trim().toLowerCase();
    if (!q) return staticDiffLines;
    return staticDiffLines.filter((line) => line.line.toLowerCase().includes(q));
  }, [staticDiffLines, configSearchQuery]);

  const linesForVirtualDiff =
    liveDiffText && remoteDiffStatus === "ok" && remoteDiffLines != null ? remoteDiffLines : staticDiffLines;

  const configColumns = React.useMemo(() => {
    const keys = new Set<string>();
    for (const row of visibleSectionRows) {
      Object.keys(row.entries).forEach((k) => keys.add(k));
    }
    return Array.from(keys);
  }, [visibleSectionRows]);

  const isConfigTable = diffViewMode === "combined" && configViewMode === "table";

  const tableGamevalType = configSectionGamevalType(section);
  const gamevalAutocompleteForTable =
    configTableSearchMode === "gameval" && tableGamevalType
      ? {
          type: tableGamevalType,
          rev: combinedRev,
          enabled:
            combinedRev >= GAMEVAL_MIN_REVISION &&
            configGamevalSuggestionSettingsEnabled(section, settings.suggestionDisplay),
        }
      : null;

  const diffLineCount =
    liveDiffText && remoteDiffStatus === "ok" && remoteDiffLines != null
      ? remoteDiffLines.length
      : fallbackDiffLines.length;

  const headlineCount = isConfigTable
    ? `${visibleSectionRows.length} configs`
    : diffViewMode === "diff"
      ? `${diffLineCount} lines`
      : `${fallbackDiffLines.length} lines`;

  const configTableSearchDisabledModes = React.useMemo((): readonly DiffSearchFieldMode[] => {
    const out: DiffSearchFieldMode[] = ["regex"];
    if (combinedRev < GAMEVAL_MIN_REVISION) out.push("gameval");
    return out;
  }, [combinedRev]);

  const configTableSearchModeTitles = React.useMemo(() => {
    const regexHint = "Regex search is not supported for config tables.";
    if (combinedRev < GAMEVAL_MIN_REVISION) {
      return {
        gameval: `Needs revision ${GAMEVAL_MIN_REVISION}+ (current ${combinedRev}).`,
        regex: regexHint,
      } as const;
    }
    return { regex: regexHint } as const;
  }, [combinedRev]);

  const sectionTitle = sectionLabel?.trim() || (section.charAt(0).toUpperCase() + section.slice(1));
  const diffHeaderTitle =
    diffViewMode === "diff" ? `${sectionTitle} (Base ${baseRev} → Compare ${rev})` : sectionTitle;

  const diffTextBooting =
    liveDiffText &&
    baseRev !== rev &&
    remoteDiffStatus === "idle" &&
    remoteDiffLines === null &&
    remoteDiffError === null;
  const diffContentBusy = liveDiffText && (remoteDiffStatus === "loading" || diffTextBooting);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DiffSectionHeader
        title={diffHeaderTitle}
        tooltipContent={diffSearchModeTooltipHelp(configTableSearchMode)}
        countLabel={`· ${headlineCount}`}
        trailing={
          diffViewMode === "combined" && !textOnly ? (
            <DiffViewModeToggle
              value={configViewMode}
              onChange={setConfigViewMode}
              options={[
                { value: "table", label: "Table" },
                { value: "text", label: "Text" },
              ]}
            />
          ) : null
        }
      />

      {isConfigTable ? (
        <>
          <div className={DIFF_COMBINED_SEARCH_WRAP_CLASS}>
            <DiffUnifiedSearchField
              mode={configTableSearchMode}
              onModeChange={setConfigTableSearchMode}
              disabledModes={configTableSearchDisabledModes}
              modeOptionTitles={configTableSearchModeTitles}
              tagModes={["gameval"]}
              value={configSearchQuery}
              onChange={(e) => setConfigSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && configTableSearchMode === "gameval" && configSearchQuery.trim()) {
                  e.preventDefault();
                  setConfigGamevalTags((prev) => [...prev, { value: configSearchQuery.trim(), exact: false }]);
                  setConfigSearchQuery("");
                }
              }}
              tags={configGamevalTags}
              onTagToggle={(idx) =>
                setConfigGamevalTags((prev) => prev.map((t, i) => (i === idx ? { ...t, exact: !t.exact } : t)))
              }
              onTagRemove={(idx) => setConfigGamevalTags((prev) => prev.filter((_, i) => i !== idx))}
              onClearTags={() => setConfigGamevalTags([])}
              gamevalAutocomplete={gamevalAutocompleteForTable}
            />
          </div>
          <DiffArchiveTable>
            <TableHeader className={DIFF_ARCHIVE_TABLE_HEADER_CLASS}>
              <TableRow>
                <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>ID</TableHead>
                {configColumns.map((key) => (
                  <TableHead key={key} className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>
                    {openruneColumnHeaderLabel(key)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleSectionRows.map((row) => (
                <TableRow key={row.id} className={DIFF_ARCHIVE_TABLE_ROW_CLASS}>
                  <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono")}>{row.id}</TableCell>
                  {configColumns.map((key) => {
                    const cell = row.entries[key] ?? "—";
                    return (
                      <TableCell
                        key={key}
                        className={DIFF_ARCHIVE_TABLE_CELL_CLASS}
                        data-col-key={key === "gameval" ? "gameval" : undefined}
                        onCopy={
                          key === "gameval"
                            ? (e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)
                            : undefined
                        }
                      >
                        {cell}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </DiffArchiveTable>
        </>
      ) : (
        <>
          {diffViewMode === "diff" ? (
            <DiffSearchToolbar
              placeholder="Search lines… (Ctrl+F)"
              value={configSearchQuery}
              onChange={(e) => setConfigSearchQuery(e.target.value)}
              inputRef={configSearchInputRef}
            />
          ) : (
            <DiffSearchToolbar
              placeholder="Search lines…"
              value={configSearchQuery}
              onChange={(e) => setConfigSearchQuery(e.target.value)}
            />
          )}
          {diffContentBusy ? (
            <div
              className="flex min-h-[12rem] flex-1 items-center justify-center p-6"
              aria-busy="true"
              aria-label="Loading diff"
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">Loading diff text...</p>
              </div>
            </div>
          ) : null}
          {liveDiffText && !diffContentBusy && remoteDiffStatus === "decoding" ? (
            <DiffDecodeProgressBanner
              progress={decodeProgress}
              fallbackMessage="Config diff is decoding on the cache server…"
            />
          ) : null}
          {liveDiffText && !diffContentBusy && remoteDiffStatus === "error" && remoteDiffError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {remoteDiffError} — showing sample lines below.
            </p>
          ) : null}
          {liveDiffText && !diffContentBusy ? (
            <DiffConfigDiffText
              lines={linesForVirtualDiff}
              filterMode="all"
              searchQuery={configSearchQuery}
              layout={diffLayout}
              configType={section}
            />
          ) : !liveDiffText && diffViewMode === "diff" ? (
            <DiffConfigDiffText
              lines={linesForVirtualDiff}
              filterMode="all"
              searchQuery={configSearchQuery}
              layout={diffLayout}
              configType={section}
            />
          ) : !liveDiffText ? (
            <div className="min-h-0 flex-1 overflow-auto bg-background">
              <div className="font-mono text-xs">
                {fallbackDiffLines.map((row, index) => (
                  <div key={`${index}-${row.line}`} className="flex items-stretch">
                    <div className="flex w-12 shrink-0 items-center justify-end border-r bg-muted/40 pr-2 text-[11px] text-muted-foreground">
                      {index + 1}
                    </div>
                    <div
                      className={cn(
                        "flex-1 px-3 py-1",
                        row.type === "add" && "bg-green-500/10",
                        row.type === "change" && "bg-amber-500/10",
                        row.type === "removed" && "bg-red-500/10",
                      )}
                    >
                      <ColorLineText text={row.line || " "} query={configSearchQuery} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

    </div>
  );
}
