"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OptionDropdown } from "@/components/ui/option-dropdown";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePaginationBar } from "@/components/ui/table-pagination-bar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCacheType } from "@/context/cache-type-context";
import type { GamevalEntry, GamevalExtraData, GamevalType } from "@/context/gameval-context";
import { useGamevals } from "@/context/gameval-context";
import { useSettings } from "@/context/settings-context";
import { cacheProxyHeaders } from "@/lib/cache-proxy-client";
import { onCopyApplyGamevalUppercaseSetting } from "@/lib/gameval-clipboard";
import { cacheGamevalGroupsUrl, parseGamevalGroups, type GamevalGroup } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { ArchivePlainTextLine } from "./diff-config-archive-entity-view";
import { DiffArchiveTable } from "./diff-archive-table";
import {
  DIFF_COMBINED_SEARCH_WRAP_CLASS,
  GAMEVAL_FULL_TAB_ORDER,
  GAMEVAL_MIN_REVISION,
  GAMEVAL_VARCS_MIN_REVISION,
  interfaceComponentCombinedId,
  TEXTURE_PER_PAGE_OPTIONS,
} from "./diff-constants";
import { DiffSectionHeader } from "./diff-section-header";
import { diffSearchModeTooltipHelp } from "./diff-search-modes";
import { DiffUnifiedSearchField } from "./diff-unified-search-field";
import { DiffViewModeToggle } from "./diff-view-mode-toggle";
import {
  GamevalsDbColumnRow,
  GamevalsInterfaceComponentRow,
  GamevalsTwoColEntryRow,
} from "./diff-gamevals-table-rows";
import type { DiffMode, DiffSearchFieldMode, Section } from "./diff-types";
import {
  DIFF_ARCHIVE_TABLE_CELL_CLASS,
  DIFF_ARCHIVE_TABLE_HEAD_CLASS,
  DIFF_ARCHIVE_TABLE_HEADER_CLASS,
} from "./diff-table-archive-styles";
import { idQueryMatchesNumericId, looksLikeSpriteIdQueryText } from "./diff-id-search";

const TEXT_LINE_HEIGHT = 22;
const TEXT_OVERSCAN = 14;
const TEXT_FIND_DEBOUNCE_MS = 100;

/** Single tab-slot control: same gameval type (`interfaces`), column mode switches. */
const INTERFACE_SLOT_OPTIONS = [
  { value: "interfaces", label: "Interfaces" },
  { value: "components", label: "Components" },
] as const;

/** Responsive width so dropdown tabs can shrink to fit narrow layouts without horizontal scrolling. */
const GAMEVAL_DROPDOWN_TAB_WIDTH_CLASS = "min-w-[7.25rem] max-w-[9rem]";
/** Slightly wider than DB slot for Interfaces / Components labels while still allowing wrap-fit. */
const GAMEVAL_INTERFACES_DROPDOWN_TAB_WIDTH_CLASS = "min-w-[8rem] max-w-[10rem]";

/** Shared shell + active/inactive styles for DB / Interfaces tab-slot `OptionDropdown`s. */
const GAMEVAL_TAB_SLOT_SHELL_CLASS =
  "inline-flex h-9 shrink-0 rounded-md border border-transparent text-sm font-medium transition-[color,box-shadow] data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground";

const GAMEVAL_TAB_DROPDOWN_BUTTON_CLASS =
  "h-9 min-h-9 w-full min-w-0 justify-between gap-1 border-0 px-2 py-1.5 text-xs font-medium shadow-none bg-transparent hover:bg-transparent dark:hover:bg-transparent aria-expanded:bg-muted/40 dark:aria-expanded:bg-muted/30";

type InterfaceSlotChoice = (typeof INTERFACE_SLOT_OPTIONS)[number]["value"];

const DB_SLOT_OPTIONS = [
  { value: "dbtables", label: "DB tables" },
  { value: "dbcolumns", label: "DB columns" },
  { value: "dbrows", label: "DB rows" },
] as const;

type DbSlotChoice = (typeof DB_SLOT_OPTIONS)[number]["value"];

function sortedInterfaceSubEntries(
  interfaceId: number,
  sub: Record<number, string>,
): { childId: number; label: string; combinedId: number }[] {
  return Object.keys(sub)
    .map((k) => Number.parseInt(k, 10))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b)
    .map((childId) => ({
      childId,
      label: (sub[childId] ?? "").trim(),
      combinedId: interfaceComponentCombinedId(interfaceId, childId),
    }));
}

function sortedDbTableSubEntries(
  tableId: number,
  sub: Record<number, string>,
): { columnId: number; label: string; combinedId: number }[] {
  return Object.keys(sub)
    .map((k) => Number.parseInt(k, 10))
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b)
    .map((columnId) => ({
      columnId,
      label: (sub[columnId] ?? "").trim(),
      combinedId: interfaceComponentCombinedId(tableId, columnId),
    }));
}

type InterfaceComponentRow = {
  combinedId: number;
  interfaceId: number;
  childId: number;
  /** Interface gameval name (`entry.name`). */
  interfaceName: string;
  /** Sub-map value (component gameval text). */
  label: string;
};

function formatInterfaceComponentDisplay(row: InterfaceComponentRow): string {
  const ig = row.interfaceName.trim() || String(row.interfaceId);
  const cg = row.label.trim() || "—";
  return `${ig}:${cg}`;
}

function buildInterfaceComponentRows(
  entries: GamevalEntry[],
  getExtra: (type: GamevalType, id: number, rev?: number | "latest") => GamevalExtraData | undefined,
  rev: number,
): InterfaceComponentRow[] {
  const rows: InterfaceComponentRow[] = [];
  for (const e of entries) {
    const sub = getExtra("interfaces", e.id, rev)?.sub ?? {};
    const childIds = Object.keys(sub)
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    for (const childId of childIds) {
      rows.push({
        combinedId: interfaceComponentCombinedId(e.id, childId),
        interfaceId: e.id,
        childId,
        interfaceName: (e.name ?? "").trim(),
        label: (sub[childId] ?? "").trim(),
      });
    }
  }
  return rows;
}

/** Packed uid: same rule as interface components (`(tableId << 16) | columnId`). */
export function dbTableColumnCombinedId(tableId: number, columnId: number): number {
  return interfaceComponentCombinedId(tableId, columnId);
}

type DbTableColumnRow = {
  combinedId: number;
  tableId: number;
  columnId: number;
  tableName: string;
  label: string;
};

function formatDbTableColumnDisplay(row: DbTableColumnRow): string {
  const tg = row.tableName.trim() || String(row.tableId);
  const cg = row.label.trim() || "—";
  return `${tg}:${cg}`;
}

function buildDbTableColumnRows(
  entries: GamevalEntry[],
  getExtra: (type: GamevalType, id: number, rev?: number | "latest") => GamevalExtraData | undefined,
  rev: number,
): DbTableColumnRow[] {
  const rows: DbTableColumnRow[] = [];
  for (const e of entries) {
    const sub = getExtra("dbtables", e.id, rev)?.sub ?? {};
    const columnIds = Object.keys(sub)
      .map((k) => Number.parseInt(k, 10))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    for (const columnId of columnIds) {
      rows.push({
        combinedId: dbTableColumnCombinedId(e.id, columnId),
        tableId: e.id,
        columnId,
        tableName: (e.name ?? "").trim(),
        label: (sub[columnId] ?? "").trim(),
      });
    }
  }
  return rows;
}

function safeRegexTest(pattern: string, haystack: string): boolean {
  try {
    const re = new RegExp(pattern, "i");
    re.lastIndex = 0;
    return re.test(haystack);
  } catch {
    return false;
  }
}

function gamevalEntryMatchesTableSearch(
  e: GamevalEntry,
  mode: DiffSearchFieldMode,
  q: string,
): boolean {
  const qt = q.trim();
  if (!qt) return true;
  if (mode === "gameval") return true;
  if (mode === "id") {
    if (looksLikeSpriteIdQueryText(qt)) return idQueryMatchesNumericId(e.id, qt);
    return String(e.id).includes(qt);
  }
  if (mode === "name") {
    const n = qt.toLowerCase();
    const nameHit = e.name.toLowerCase().includes(n) || e.lowerName.includes(n);
    if (looksLikeSpriteIdQueryText(qt)) return nameHit || idQueryMatchesNumericId(e.id, qt);
    return nameHit;
  }
  if (mode === "regex") {
    if (looksLikeSpriteIdQueryText(qt)) return idQueryMatchesNumericId(e.id, qt);
    const hay = `${e.name}\n${e.id}`;
    return safeRegexTest(qt, hay);
  }
  return true;
}

function interfaceComponentRowMatchesTableSearch(
  row: InterfaceComponentRow,
  mode: DiffSearchFieldMode,
  q: string,
): boolean {
  const qt = q.trim();
  if (!qt) return true;
  if (mode === "gameval") return true;
  if (mode === "id") {
    if (looksLikeSpriteIdQueryText(qt)) {
      return (
        idQueryMatchesNumericId(row.combinedId, qt) ||
        idQueryMatchesNumericId(row.interfaceId, qt) ||
        idQueryMatchesNumericId(row.childId, qt)
      );
    }
    return (
      String(row.combinedId).includes(qt) ||
      String(row.interfaceId).includes(qt) ||
      String(row.childId).includes(qt)
    );
  }
  if (mode === "name") {
    const n = qt.toLowerCase();
    const nameHit =
      row.interfaceName.toLowerCase().includes(n) ||
      row.label.toLowerCase().includes(n) ||
      formatInterfaceComponentDisplay(row).toLowerCase().includes(n);
    if (looksLikeSpriteIdQueryText(qt)) {
      return (
        nameHit ||
        idQueryMatchesNumericId(row.combinedId, qt) ||
        idQueryMatchesNumericId(row.interfaceId, qt) ||
        idQueryMatchesNumericId(row.childId, qt)
      );
    }
    return nameHit;
  }
  if (mode === "regex") {
    if (looksLikeSpriteIdQueryText(qt)) {
      return (
        idQueryMatchesNumericId(row.combinedId, qt) ||
        idQueryMatchesNumericId(row.interfaceId, qt) ||
        idQueryMatchesNumericId(row.childId, qt)
      );
    }
    const hay = [
      row.interfaceName,
      row.label,
      formatInterfaceComponentDisplay(row),
      String(row.combinedId),
      String(row.interfaceId),
      String(row.childId),
    ].join("\n");
    return safeRegexTest(qt, hay);
  }
  return true;
}

function dbColumnRowMatchesTableSearch(row: DbTableColumnRow, mode: DiffSearchFieldMode, q: string): boolean {
  const qt = q.trim();
  if (!qt) return true;
  if (mode === "gameval") return true;
  if (mode === "id") {
    if (looksLikeSpriteIdQueryText(qt)) {
      return (
        idQueryMatchesNumericId(row.combinedId, qt) ||
        idQueryMatchesNumericId(row.tableId, qt) ||
        idQueryMatchesNumericId(row.columnId, qt)
      );
    }
    return (
      String(row.combinedId).includes(qt) ||
      String(row.tableId).includes(qt) ||
      String(row.columnId).includes(qt)
    );
  }
  if (mode === "name") {
    const n = qt.toLowerCase();
    const nameHit =
      row.tableName.toLowerCase().includes(n) ||
      row.label.toLowerCase().includes(n) ||
      formatDbTableColumnDisplay(row).toLowerCase().includes(n);
    if (looksLikeSpriteIdQueryText(qt)) {
      return (
        nameHit ||
        idQueryMatchesNumericId(row.combinedId, qt) ||
        idQueryMatchesNumericId(row.tableId, qt) ||
        idQueryMatchesNumericId(row.columnId, qt)
      );
    }
    return nameHit;
  }
  if (mode === "regex") {
    if (looksLikeSpriteIdQueryText(qt)) {
      return (
        idQueryMatchesNumericId(row.combinedId, qt) ||
        idQueryMatchesNumericId(row.tableId, qt) ||
        idQueryMatchesNumericId(row.columnId, qt)
      );
    }
    const hay = [
      row.tableName,
      row.label,
      formatDbTableColumnDisplay(row),
      String(row.combinedId),
      String(row.tableId),
      String(row.columnId),
    ].join("\n");
    return safeRegexTest(qt, hay);
  }
  return true;
}

/** Gameval explorer does not use tag-style gameval search here. */
const GAMEVALS_SEARCH_DISABLED_MODES: readonly DiffSearchFieldMode[] = ["gameval"];

/** Map gameval dump tab to `diff/config/{type}/content` type name (for URLs / tooling). */
export function gamevalsTabToConfigType(tab: GamevalType): string | null {
  if (tab === "spotanims") return "spotanim";
  if (tab === "interfaces") return "components";
  return tab;
}

/** Legacy: URL used to encode `gamevals_${tab}`. Prefer `gamevalsTabToConfigType`. */
export function gamevalsSectionToConfigType(section: Section): string | null {
  if (!section.startsWith("gamevals_")) return null;
  return gamevalsTabToConfigType(section.slice("gamevals_".length) as GamevalType);
}

function gamevalsTitle(tab: GamevalType): string {
  const displayKey = tab === "interfaces" ? "interfaces" : tab;
  return `Gamevals ${displayKey.charAt(0).toUpperCase() + displayKey.slice(1)}`;
}

function gamevalTabLabel(tab: GamevalType): string {
  const manual: Partial<Record<GamevalType, string>> = {
    dbrows: "DB rows",
    dbtables: "DB tables",
    spotanims: "Spot anims",
  };
  return manual[tab] ?? `${tab.charAt(0).toUpperCase()}${tab.slice(1)}`;
}

type DiffGamevalsFullViewProps = {
  section: Section;
  /** Which gameval type tab is active (driven by layout state, not `section`). */
  activeGamevalTab: GamevalType;
  diffViewMode: DiffMode;
  combinedRev: number;
  rev: number;
  onSelectGamevalTab: (tab: GamevalType) => void;
};

export function DiffGamevalsFullView({
  section,
  activeGamevalTab,
  diffViewMode,
  combinedRev,
  rev,
  onSelectGamevalTab,
}: DiffGamevalsFullViewProps) {
  const searchParams = useSearchParams();
  const { selectedCacheType } = useCacheType();
  const { loadGamevalType, getGamevalEntries, getGamevalExtra, hasLoaded, isLoading } = useGamevals();
  const { settings } = useSettings();
  const urlWantsText = diffViewMode === "combined" && searchParams.get("view") === "text";

  const [gamevalGroupsById, setGamevalGroupsById] = React.useState<Map<string, GamevalGroup>>(new Map());

  React.useEffect(() => {
    let cancelled = false;
    async function loadGroups() {
      try {
        const res = await fetch(cacheGamevalGroupsUrl(), {
          cache: "no-store",
          headers: cacheProxyHeaders(selectedCacheType),
        });
        if (!res.ok) return;
        const parsed = parseGamevalGroups(await res.json());
        if (cancelled) return;
        setGamevalGroupsById(new Map(parsed.map((g) => [g.id, g])));
      } catch {
        // Keep static fallback labels/min revisions when endpoint is unavailable.
      }
    }
    void loadGroups();
    return () => {
      cancelled = true;
    };
  }, [selectedCacheType]);

  const groupForTab = React.useCallback(
    (tab: GamevalType): GamevalGroup | undefined =>
      gamevalGroupsById.get(tab) ?? (tab === "interfaces" ? gamevalGroupsById.get("components") : undefined),
    [gamevalGroupsById],
  );

  const gamevalTabs = React.useMemo<GamevalType[]>(() => {
    const dynamic = [...new Set([...gamevalGroupsById.values()].map((g) => (g.id === "components" ? "interfaces" : g.id)))];
    if (dynamic.length > 0) return dynamic;
    return [...GAMEVAL_FULL_TAB_ORDER];
  }, [gamevalGroupsById]);

  const globalGamevalMinRevision = React.useMemo(() => {
    const mins = [...gamevalGroupsById.values()].map((g) => g.minRevision).filter((n) => Number.isFinite(n));
    return mins.length > 0 ? Math.min(...mins) : GAMEVAL_MIN_REVISION;
  }, [gamevalGroupsById]);

  const varcsMinRevision = groupForTab("varcs")?.minRevision ?? GAMEVAL_VARCS_MIN_REVISION;
  const activeTabMinRevision = groupForTab(activeGamevalTab)?.minRevision ?? globalGamevalMinRevision;
  const activeTabLabel = groupForTab(activeGamevalTab)?.label ?? gamevalTabLabel(activeGamevalTab);

  const title = `Gamevals ${activeTabLabel}`;
  const isInterfacesTab = activeGamevalTab === "interfaces";
  const isDbTablesTab = activeGamevalTab === "dbtables";

  const [dbTableViewMode, setDbTableViewMode] = React.useState<"tables" | "columns">("tables");

  /** Keeps DB dropdown label in sync with URL + local columns mode on the same render. */
  const dbDropdownValue: DbSlotChoice =
    activeGamevalTab === "dbrows" ? "dbrows" : dbTableViewMode === "columns" ? "dbcolumns" : "dbtables";

  const [viewMode, setViewMode] = React.useState<"table" | "text">(() =>
    urlWantsText ? "text" : "table",
  );
  const [searchText, setSearchText] = React.useState("");
  const [searchFieldMode, setSearchFieldMode] = React.useState<DiffSearchFieldMode>("name");
  const debouncedSearchQuery = useDebouncedValue(searchText.trim(), 180);

  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState<number>(TEXTURE_PER_PAGE_OPTIONS[0]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [textFindQuery, setTextFindQuery] = React.useState("");
  const [textFindKind, setTextFindKind] = React.useState<"literal" | "regex">("literal");
  const [textFindActiveIdx, setTextFindActiveIdx] = React.useState(0);
  const debouncedTextFindQuery = useDebouncedValue(textFindQuery.trim(), TEXT_FIND_DEBOUNCE_MS);

  const [interfaceSlotChoice, setInterfaceSlotChoice] = React.useState<InterfaceSlotChoice>("interfaces");
  const isInterfaceComponentsMode = isInterfacesTab && interfaceSlotChoice === "components";
  const isDbColumnsMode = isDbTablesTab && dbTableViewMode === "columns";
  /** Noun for Name-mode placeholder: matches the primary text column for the current table shape. */
  const nameSearchTargetNoun = React.useMemo(() => {
    if (isInterfaceComponentsMode) return "Component";
    if (isDbColumnsMode) return "Column";
    if (activeGamevalTab === "interfaces") return "Interfaces";
    return "Name";
  }, [isInterfaceComponentsMode, isDbColumnsMode, activeGamevalTab]);
  const tableSearchPlaceholders = React.useMemo(
    () => ({
      name: `Search ${nameSearchTargetNoun} (substring, case-insensitive)`,
    }),
    [nameSearchTargetNoun],
  );
  const [ifaceDetailEntry, setIfaceDetailEntry] = React.useState<GamevalEntry | null>(null);
  const [ifaceDetailModalOpen, setIfaceDetailModalOpen] = React.useState(false);
  const [dbTableDetailEntry, setDbTableDetailEntry] = React.useState<GamevalEntry | null>(null);
  const [dbTableDetailModalOpen, setDbTableDetailModalOpen] = React.useState(false);

  const openIfaceDetailFromRow = React.useCallback((e: GamevalEntry) => {
    setIfaceDetailEntry(e);
    setIfaceDetailModalOpen(true);
  }, []);

  const openDbTableDetailFromRow = React.useCallback((e: GamevalEntry) => {
    setDbTableDetailEntry(e);
    setDbTableDetailModalOpen(true);
  }, []);

  const textScrollRef = React.useRef<HTMLDivElement | null>(null);
  const textVirtRafRef = React.useRef<number | null>(null);
  const textVirtPendingRef = React.useRef({ scrollTop: 0, clientHeight: 400 });
  const [textVirt, setTextVirt] = React.useState({ scrollTop: 0, clientHeight: 400 });

  const gamevalRev = diffViewMode === "combined" ? combinedRev : rev;
  const varcsBlocked = activeGamevalTab === "varcs" && combinedRev < varcsMinRevision;
  const gamevalApiSupported = gamevalRev >= activeTabMinRevision && !varcsBlocked;

  React.useEffect(() => {
    setViewMode(urlWantsText ? "text" : "table");
  }, [urlWantsText]);

  React.useEffect(() => {
    setSearchText("");
    setSearchFieldMode("name");
    setPage(1);
    setTextFindQuery("");
    setTextFindActiveIdx(0);
  }, [activeGamevalTab, combinedRev]);

  React.useEffect(() => {
    setInterfaceSlotChoice("interfaces");
  }, [combinedRev]);

  React.useEffect(() => {
    setDbTableViewMode("tables");
  }, [combinedRev]);

  React.useEffect(() => {
    if (activeGamevalTab !== "dbtables") setDbTableViewMode("tables");
  }, [activeGamevalTab]);

  React.useEffect(() => {
    if (gamevalTabs.length === 0) return;
    if (gamevalTabs.includes(activeGamevalTab)) return;
    onSelectGamevalTab(gamevalTabs[0]!);
  }, [gamevalTabs, activeGamevalTab, onSelectGamevalTab]);

  React.useEffect(() => {
    setIfaceDetailModalOpen(false);
    setIfaceDetailEntry(null);
    setDbTableDetailModalOpen(false);
    setDbTableDetailEntry(null);
  }, [activeGamevalTab, interfaceSlotChoice, dbTableViewMode, viewMode]);

  /** Clear row after close animation so the panel never flashes empty (matches dialog `duration-200`). */
  React.useEffect(() => {
    if (ifaceDetailModalOpen) return;
    const t = window.setTimeout(() => {
      setIfaceDetailEntry(null);
    }, 220);
    return () => window.clearTimeout(t);
  }, [ifaceDetailModalOpen]);

  React.useEffect(() => {
    if (dbTableDetailModalOpen) return;
    const t = window.setTimeout(() => {
      setDbTableDetailEntry(null);
    }, 220);
    return () => window.clearTimeout(t);
  }, [dbTableDetailModalOpen]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, perPage, interfaceSlotChoice, dbTableViewMode, searchFieldMode]);

  React.useEffect(() => {
    if (diffViewMode !== "combined" || varcsBlocked || !gamevalApiSupported) {
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    void loadGamevalType(activeGamevalTab, combinedRev).catch((e) => {
      if (!cancelled) {
        setLoadError(e instanceof Error ? e.message : "Failed to load gamevals");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [diffViewMode, activeGamevalTab, combinedRev, loadGamevalType, varcsBlocked, gamevalApiSupported]);

  const entriesReady = hasLoaded(activeGamevalTab, combinedRev);

  const allEntries = React.useMemo(() => {
    if (!gamevalApiSupported) return [] as GamevalEntry[];
    const raw = getGamevalEntries(activeGamevalTab, combinedRev) ?? [];
    return [...raw].sort((a, b) => a.id - b.id);
  }, [gamevalApiSupported, getGamevalEntries, activeGamevalTab, combinedRev, entriesReady]);

  const filteredEntries = React.useMemo(() => {
    const q = debouncedSearchQuery;
    if (!q.trim()) return allEntries;
    return allEntries.filter((e) => gamevalEntryMatchesTableSearch(e, searchFieldMode, q));
  }, [allEntries, debouncedSearchQuery, searchFieldMode]);

  const allComponentRows = React.useMemo(
    () =>
      isInterfaceComponentsMode && gamevalApiSupported
        ? buildInterfaceComponentRows(allEntries, getGamevalExtra, gamevalRev)
        : ([] as InterfaceComponentRow[]),
    [isInterfaceComponentsMode, gamevalApiSupported, allEntries, getGamevalExtra, gamevalRev],
  );

  const filteredComponentRows = React.useMemo(() => {
    if (!isInterfaceComponentsMode) return [] as InterfaceComponentRow[];
    const q = debouncedSearchQuery;
    if (!q.trim()) return allComponentRows;
    return allComponentRows.filter((r) => interfaceComponentRowMatchesTableSearch(r, searchFieldMode, q));
  }, [isInterfaceComponentsMode, allComponentRows, debouncedSearchQuery, searchFieldMode]);

  const allDbColumnRows = React.useMemo(
    () =>
      isDbColumnsMode && gamevalApiSupported
        ? buildDbTableColumnRows(allEntries, getGamevalExtra, gamevalRev)
        : ([] as DbTableColumnRow[]),
    [isDbColumnsMode, gamevalApiSupported, allEntries, getGamevalExtra, gamevalRev],
  );

  const filteredDbColumnRows = React.useMemo(() => {
    if (!isDbColumnsMode) return [] as DbTableColumnRow[];
    const q = debouncedSearchQuery;
    if (!q.trim()) return allDbColumnRows;
    return allDbColumnRows.filter((r) => dbColumnRowMatchesTableSearch(r, searchFieldMode, q));
  }, [isDbColumnsMode, allDbColumnRows, debouncedSearchQuery, searchFieldMode]);

  /** Text mode lists all entries; table search (ID / name / regex) applies in table mode only. */
  const textLines = React.useMemo(() => {
    if (isInterfaceComponentsMode) {
      const source = viewMode === "text" ? allComponentRows : filteredComponentRows;
      return source.map((r) => `${r.combinedId}=${formatInterfaceComponentDisplay(r)}`);
    }
    if (isDbColumnsMode) {
      const source = viewMode === "text" ? allDbColumnRows : filteredDbColumnRows;
      return source.map((r) => `${r.combinedId}=${formatDbTableColumnDisplay(r)}`);
    }
    const rows = viewMode === "text" ? allEntries : filteredEntries;
    return rows.map((e) => `${e.id}=${e.name || ""}`);
  }, [
    viewMode,
    allEntries,
    filteredEntries,
    isInterfaceComponentsMode,
    isDbColumnsMode,
    allComponentRows,
    filteredComponentRows,
    allDbColumnRows,
    filteredDbColumnRows,
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

  const textMatchIndices = React.useMemo(() => {
    if (textFindMatcher.mode !== "ok") return [];
    const test = textFindMatcher.test;
    const out: number[] = [];
    for (let i = 0; i < textLines.length; i++) {
      if (test(textLines[i] ?? "")) out.push(i);
    }
    return out;
  }, [textLines, textFindMatcher]);

  const textMatchSet = React.useMemo(() => new Set(textMatchIndices), [textMatchIndices]);

  const textFindHasMatches = textMatchIndices.length > 0;
  const textFindHasQuery = textFindQuery.trim().length > 0;
  const textFindNavDisabled =
    !textFindHasQuery ||
    Boolean(textRegexErrorImmediate) ||
    !textFindHasMatches ||
    textFindMatcher.mode === "bad" ||
    textFindMatcher.mode === "empty";

  React.useEffect(() => {
    const n = textMatchIndices.length;
    setTextFindActiveIdx((i) => {
      if (n === 0) return 0;
      return Math.min(Math.max(0, i), n - 1);
    });
  }, [textMatchIndices]);

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
    return () => {
      if (textVirtRafRef.current != null) {
        window.cancelAnimationFrame(textVirtRafRef.current);
        textVirtRafRef.current = null;
      }
    };
  }, []);

  const textVirtualWindow = React.useMemo(() => {
    const total = textLines.length;
    const rowH = TEXT_LINE_HEIGHT;
    if (total === 0) return { start: 0, end: 0, topPx: 0, totalLines: 0, rowH };
    const { scrollTop, clientHeight } = textVirt;
    const ch = Math.max(clientHeight, 1);
    const start = Math.max(0, Math.floor(scrollTop / rowH) - TEXT_OVERSCAN);
    const end = Math.min(total, Math.ceil((scrollTop + ch) / rowH) + TEXT_OVERSCAN);
    return { start, end, topPx: start * rowH, totalLines: total, rowH };
  }, [textLines.length, textVirt]);

  const activeTextLineIndex =
    textMatchIndices.length > 0
      ? textMatchIndices[Math.min(textFindActiveIdx, textMatchIndices.length - 1)]!
      : null;

  React.useEffect(() => {
    if (viewMode !== "text" || activeTextLineIndex == null) return;
    const root = textScrollRef.current;
    if (!root) return;
    const rowH = TEXT_LINE_HEIGHT;
    const rowTop = activeTextLineIndex * rowH;
    const viewTop = root.scrollTop;
    const viewH = root.clientHeight;
    const pad = 8;
    if (rowTop < viewTop + pad) {
      root.scrollTop = Math.max(0, rowTop - pad);
    } else if (rowTop + rowH > viewTop + viewH - pad) {
      root.scrollTop = rowTop - viewH + rowH + pad;
    }
  }, [viewMode, activeTextLineIndex, textFindActiveIdx]);

  const tableRowCount = isInterfaceComponentsMode
    ? filteredComponentRows.length
    : isDbColumnsMode
      ? filteredDbColumnRows.length
      : filteredEntries.length;
  const totalPages = Math.max(1, Math.ceil(tableRowCount / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);

  React.useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageSlice = React.useMemo(() => {
    const start = (safePage - 1) * perPage;
    if (isInterfaceComponentsMode) {
      return filteredComponentRows.slice(start, start + perPage);
    }
    if (isDbColumnsMode) {
      return filteredDbColumnRows.slice(start, start + perPage);
    }
    return filteredEntries.slice(start, start + perPage);
  }, [
    isInterfaceComponentsMode,
    isDbColumnsMode,
    filteredComponentRows,
    filteredDbColumnRows,
    filteredEntries,
    safePage,
    perPage,
  ]);

  const loadingList =
    gamevalApiSupported &&
    !loadError &&
    (isLoading(activeGamevalTab, combinedRev) || !entriesReady);

  React.useLayoutEffect(() => {
    if (viewMode !== "text") return;
    const el = textScrollRef.current;
    if (!el) return;
    setTextVirt((v) => ({
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight > 0 ? el.clientHeight : v.clientHeight,
    }));
  }, [viewMode, textLines.length, loadingList]);

  const findErrorId = `gv-text-find-${activeGamevalTab}`;

  const ifaceDetailSubRows = React.useMemo(() => {
    if (!ifaceDetailEntry || !gamevalApiSupported) return [];
    const sub = getGamevalExtra("interfaces", ifaceDetailEntry.id, combinedRev)?.sub ?? {};
    return sortedInterfaceSubEntries(ifaceDetailEntry.id, sub);
  }, [ifaceDetailEntry, gamevalApiSupported, getGamevalExtra, combinedRev]);

  const dbTableDetailSubRows = React.useMemo(() => {
    if (!dbTableDetailEntry || !gamevalApiSupported) return [];
    const sub = getGamevalExtra("dbtables", dbTableDetailEntry.id, combinedRev)?.sub ?? {};
    return sortedDbTableSubEntries(dbTableDetailEntry.id, sub);
  }, [dbTableDetailEntry, gamevalApiSupported, getGamevalExtra, combinedRev]);

  React.useEffect(() => {
    if (!dbTableDetailModalOpen || !gamevalApiSupported) return;
    void loadGamevalType("dbrows", combinedRev).catch(() => {});
  }, [dbTableDetailModalOpen, combinedRev, gamevalApiSupported, loadGamevalType]);

  const dbTableDetailRelatedRows = React.useMemo(() => {
    if (!dbTableDetailEntry || !gamevalApiSupported) return [] as GamevalEntry[];
    const tableName = (dbTableDetailEntry.name ?? "").trim();
    if (!tableName) return [];
    if (!hasLoaded("dbrows", combinedRev)) return [];
    const prefix = `${tableName}_`.toLowerCase();
    const allDbRows = getGamevalEntries("dbrows", combinedRev) ?? [];
    return allDbRows
      .filter((e) => (e.name ?? "").trim().toLowerCase().startsWith(prefix))
      .sort((a, b) => a.id - b.id);
  }, [dbTableDetailEntry, gamevalApiSupported, hasLoaded, getGamevalEntries, combinedRev]);

  const headlineCount =
    viewMode === "table"
      ? tableRowCount
      : isInterfaceComponentsMode
        ? allComponentRows.length
        : isDbColumnsMode
          ? allDbColumnRows.length
          : allEntries.length;
  const headlineWord =
    viewMode === "text"
      ? headlineCount === 1
        ? "line"
        : "lines"
      : isInterfaceComponentsMode
        ? headlineCount === 1
          ? "component"
          : "components"
        : isDbColumnsMode
          ? headlineCount === 1
            ? "column"
            : "columns"
          : headlineCount === 1
            ? "entry"
            : "entries";

  const gamevalsTableSearchTooltip = React.useMemo(
    () => (
      <div className="space-y-3">
        {(["id", "name", "regex"] as const).map((m) => (
          <React.Fragment key={m}>{diffSearchModeTooltipHelp(m)}</React.Fragment>
        ))}
        {isInterfaceComponentsMode ? (
          <p className="border-t border-zinc-700 pt-2 text-xs text-white/90">
            {
              "Rows are interface sub-components. In ID mode, the packed id is (interface id << 16) | child id; searches also match the interface id and child id columns separately."
            }
          </p>
        ) : isDbColumnsMode ? (
          <p className="border-t border-zinc-700 pt-2 text-xs text-white/90">
            {
              "Rows are DB table columns from extras. In ID mode, the packed id is (table id << 16) | column id; searches also match the table id and column id columns separately."
            }
          </p>
        ) : null}
      </div>
    ),
    [isInterfaceComponentsMode, isDbColumnsMode],
  );

  const threeColTableMode = isInterfaceComponentsMode || isDbColumnsMode;
  const defaultNameColumnLabel = activeGamevalTab === "interfaces" ? "Interfaces" : "Name";

  if (diffViewMode !== "combined") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <DiffSectionHeader
          title={title}
          tooltipContent={diffSearchModeTooltipHelp("id")}
          countLabel="· Full mode only"
        />
        <p className="text-sm text-muted-foreground">
          Live gameval listings load from the cache server in <span className="font-medium text-foreground">Full</span>{" "}
          mode only. Switch using the sidebar, same as openrune.github.io.
        </p>
      </div>
    );
  }

  if (section !== "gamevals") {
    return (
      <div className="text-sm text-destructive">
        Unknown gamevals section <span className="font-mono">{section}</span>.
      </div>
    );
  }

  return (
    <Tabs
      value={activeGamevalTab}
      onValueChange={(v) => onSelectGamevalTab(v as GamevalType)}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
    >
      <div className="w-full min-w-0 shrink-0 px-2 py-1.5">
        <TabsList className="flex h-auto min-h-12 w-full min-w-0 max-w-full flex-wrap items-center justify-center gap-1 bg-muted/50 p-1.5">
          {gamevalTabs.filter((t) => t !== "dbrows").map((tab) => {
            const tabMeta = groupForTab(tab);
            const tabLabel = tabMeta?.label ?? gamevalTabLabel(tab);
            const tabMinRevision = tabMeta?.minRevision ?? (tab === "varcs" ? varcsMinRevision : globalGamevalMinRevision);
            const tabLocked = combinedRev < tabMinRevision;
            if (tab === "dbtables") {
              const dbActive = activeGamevalTab === "dbtables" || activeGamevalTab === "dbrows";
              return (
                <React.Fragment key="db-slot">
                  <div
                    data-slot="tabs-trigger"
                    data-state={dbActive ? "active" : "inactive"}
                    className={cn(GAMEVAL_TAB_SLOT_SHELL_CLASS, GAMEVAL_DROPDOWN_TAB_WIDTH_CLASS)}
                  >
                    <OptionDropdown
                      value={dbDropdownValue}
                      options={[...DB_SLOT_OPTIONS]}
                      onChange={(v) => {
                        const choice = v as DbSlotChoice;
                        if (choice === "dbrows") {
                          onSelectGamevalTab("dbrows");
                          return;
                        }
                        onSelectGamevalTab("dbtables");
                        setDbTableViewMode(choice === "dbcolumns" ? "columns" : "tables");
                      }}
                      splitAffirm
                      onAffirmPrimary={() => {
                        if (dbDropdownValue === "dbrows") onSelectGamevalTab("dbrows");
                        else onSelectGamevalTab("dbtables");
                      }}
                      ariaLabel="DB tables, DB columns, or DB rows"
                      buttonVariant="ghost"
                      menuMinWidthPx={0}
                      className="w-full min-w-0"
                      buttonClassName={GAMEVAL_TAB_DROPDOWN_BUTTON_CLASS}
                    />
                  </div>
                  {/* Match Tabs `value` to real triggers so controlled highlight does not flicker. */}
                  <TabsTrigger
                    value="dbtables"
                    tabIndex={-1}
                    aria-hidden={true}
                    className="sr-only pointer-events-none"
                  >
                    dbtables
                  </TabsTrigger>
                  <TabsTrigger
                    value="dbrows"
                    tabIndex={-1}
                    aria-hidden={true}
                    className="sr-only pointer-events-none"
                  >
                    dbrows
                  </TabsTrigger>
                </React.Fragment>
              );
            }
            if (tab === "interfaces") {
              const interfacesActive = activeGamevalTab === "interfaces";
              return (
                <React.Fragment key="interfaces">
                  <div
                    data-slot="tabs-trigger"
                    data-state={interfacesActive ? "active" : "inactive"}
                    className={cn(GAMEVAL_TAB_SLOT_SHELL_CLASS, GAMEVAL_INTERFACES_DROPDOWN_TAB_WIDTH_CLASS)}
                  >
                    <OptionDropdown
                      value={interfaceSlotChoice}
                      options={[...INTERFACE_SLOT_OPTIONS]}
                      onChange={(v) => {
                        const next = v as InterfaceSlotChoice;
                        setInterfaceSlotChoice(next);
                        onSelectGamevalTab("interfaces");
                      }}
                      splitAffirm
                      onAffirmPrimary={() => {
                        onSelectGamevalTab("interfaces");
                      }}
                      ariaLabel="Interfaces or components listing"
                      buttonVariant="ghost"
                      menuMinWidthPx={0}
                      className="w-full min-w-0"
                      buttonClassName={GAMEVAL_TAB_DROPDOWN_BUTTON_CLASS}
                    />
                  </div>
                  <TabsTrigger
                    value="interfaces"
                    tabIndex={-1}
                    aria-hidden={true}
                    className="sr-only pointer-events-none"
                  >
                    interfaces
                  </TabsTrigger>
                </React.Fragment>
              );
            }
            return (
              <TabsTrigger
                key={tab}
                value={tab}
                disabled={tabLocked}
                title={
                  tabLocked
                    ? `${tabLabel} is only available from revision ${tabMinRevision} onward.`
                    : undefined
                }
                className="h-9 shrink-0 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap sm:text-sm"
              >
                {tabLabel}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      <DiffSectionHeader
        title={title}
        tooltipContent={
          viewMode === "table"
            ? gamevalsTableSearchTooltip
            : "Find in text: String = case-insensitive substring. Regex = JavaScript pattern (case-insensitive). Enter = next match, Shift+Enter = previous."
        }
        countLabel={`· ${headlineCount.toLocaleString()} ${headlineWord}`}
        trailing={
          <DiffViewModeToggle
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "table", label: "Table" },
              { value: "text", label: "Text" },
            ]}
          />
        }
      />

      {!gamevalApiSupported ? (
        <p className="text-sm text-muted-foreground">
          {varcsBlocked
            ? `Switch to revision ${varcsMinRevision} or newer to load varcs.`
            : `Pick revision ${activeTabMinRevision}+ in the sidebar to load gameval enums from the cache server.`}
        </p>
      ) : (
        <>
          {viewMode === "table" ? (
            <div className={DIFF_COMBINED_SEARCH_WRAP_CLASS}>
              <DiffUnifiedSearchField
                mode={searchFieldMode}
                onModeChange={setSearchFieldMode}
                disabledModes={GAMEVALS_SEARCH_DISABLED_MODES}
                placeholders={tableSearchPlaceholders}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                gamevalAutocomplete={null}
        />
      </div>
          ) : null}

          {viewMode === "text" ? (
            <div className="mb-3 w-fit max-w-full min-w-0 shrink-0 self-start">
              <div className="relative z-[70] flex min-w-0 max-w-full flex-col gap-1.5">
                <div
                  className={cn(
                    "relative z-50 flex h-8 min-w-0 max-w-full flex-nowrap items-stretch rounded-md border border-border bg-muted/25 shadow-sm",
                    "dark:bg-muted/20",
                  )}
                >
                  <label className="flex min-h-0 w-[min(13rem,100%)] shrink cursor-text items-center gap-2 pl-2 pr-0.5 sm:w-[min(14rem,100%)]">
                    <span className="sr-only">Find in gameval text</span>
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
                      aria-label="Find mode"
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
                        textFindNavDisabled ? "Match count unavailable" : `Match ${textFindActiveIdx + 1} of ${textMatchIndices.length}`
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
            </div>
          ) : null}

          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : loadingList ? (
            viewMode === "table" ? (
              <DiffArchiveTable aria-busy={true} aria-label="Loading gamevals">
                <TableHeader className={DIFF_ARCHIVE_TABLE_HEADER_CLASS}>
                  <TableRow>
                    <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>ID</TableHead>
                    {threeColTableMode ? (
                      isInterfaceComponentsMode ? (
                        <>
                          <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Interface</TableHead>
                          <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Component</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Table</TableHead>
                          <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Column</TableHead>
                        </>
                      )
                    ) : (
                      <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>{defaultNameColumnLabel}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: Math.min(perPage, 12) }, (_, i) => (
                    <TableRow key={i} className="border-t align-top hover:bg-transparent">
                      <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                        <Skeleton className="h-4 w-12" delayMs={i * 20} shimmer={false} />
                      </TableCell>
                      {threeColTableMode ? (
                        <>
                          <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                            <Skeleton className="h-4 w-10" delayMs={i * 20 + 6} shimmer={false} />
                          </TableCell>
                          <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                            <Skeleton className="h-4 w-48 max-w-full" delayMs={i * 20 + 8} shimmer={false} />
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                          <Skeleton className="h-4 w-48 max-w-full" delayMs={i * 20 + 8} shimmer={false} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </DiffArchiveTable>
            ) : (
              <div
                className="flex min-h-0 flex-1 items-center justify-center rounded-md border bg-background p-6"
                aria-busy="true"
                aria-label="Loading gamevals text"
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
                  <p className="text-sm text-muted-foreground">Loading gamevals text...</p>
                </div>
              </div>
            )
          ) : viewMode === "table" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              <DiffArchiveTable aria-label={`${gamevalTabLabel(activeGamevalTab)} gamevals`}>
                <TableHeader className={DIFF_ARCHIVE_TABLE_HEADER_CLASS}>
                  <TableRow>
                    <TableHead className={cn(DIFF_ARCHIVE_TABLE_HEAD_CLASS, "w-28")}>ID</TableHead>
                    {threeColTableMode ? (
                      isInterfaceComponentsMode ? (
                        <>
                          <TableHead className={cn(DIFF_ARCHIVE_TABLE_HEAD_CLASS, "w-24")}>Interface</TableHead>
                          <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Component</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className={cn(DIFF_ARCHIVE_TABLE_HEAD_CLASS, "w-24")}>Table</TableHead>
                          <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Column</TableHead>
                        </>
                      )
                    ) : (
                      <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>{defaultNameColumnLabel}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageSlice.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={threeColTableMode ? 3 : 2}
                        className="p-4 text-center text-sm text-muted-foreground"
                      >
                        {debouncedSearchQuery.trim()
                          ? (() => {
                              const kind =
                                searchFieldMode === "id"
                                  ? "ID"
                                  : searchFieldMode === "name"
                                    ? "name"
                                    : "regex";
                              if (isInterfaceComponentsMode) return `No components match this ${kind} search.`;
                              if (isDbColumnsMode) return `No DB columns match this ${kind} search.`;
                              return `No entries match this ${kind} search.`;
                            })()
                          : isInterfaceComponentsMode
                            ? "No component rows (empty subs on all interfaces)."
                            : isDbColumnsMode
                              ? "No column rows (empty subs on all DB tables)."
                              : "No gameval entries returned for this type."}
                      </TableCell>
                    </TableRow>
                  ) : isInterfaceComponentsMode ? (
                    (pageSlice as InterfaceComponentRow[]).map((r) => (
                      <GamevalsInterfaceComponentRow
                        key={`${r.interfaceId}-${r.childId}`}
                        combinedId={r.combinedId}
                        interfaceId={r.interfaceId}
                        displayText={formatInterfaceComponentDisplay(r)}
                      />
                    ))
                  ) : isDbColumnsMode ? (
                    (pageSlice as DbTableColumnRow[]).map((r) => (
                      <GamevalsDbColumnRow
                        key={`${r.tableId}-${r.columnId}`}
                        combinedId={r.combinedId}
                        tableId={r.tableId}
                        displayText={formatDbTableColumnDisplay(r)}
                      />
                    ))
                  ) : (
                    (pageSlice as GamevalEntry[]).map((e) => {
                      const ifaceRowClickable = isInterfacesTab && interfaceSlotChoice === "interfaces";
                      const dbTableRowClickable = isDbTablesTab && dbTableViewMode === "tables";
                      return (
                        <GamevalsTwoColEntryRow
                          key={e.id}
                          entry={e}
                          onActivate={
                            ifaceRowClickable
                              ? openIfaceDetailFromRow
                              : dbTableRowClickable
                                ? openDbTableDetailFromRow
                                : undefined
                          }
                        />
                      );
                    })
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
                showingCount={pageSlice.length}
                totalCount={tableRowCount}
                countLabel={
                  isInterfaceComponentsMode ? "components" : isDbColumnsMode ? "columns" : "entries"
                }
              />
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
                  <div className="flex min-h-[12rem] items-start p-4 text-sm text-muted-foreground">
                    No gameval entries for this type.
              </div>
            ) : (
              <div
                className="absolute left-0 right-0"
                    style={{ top: textVirtualWindow.topPx, willChange: "transform" }}
                  >
                    {textLines.slice(textVirtualWindow.start, textVirtualWindow.end).map((line, j) => {
                      const i = textVirtualWindow.start + j;
                      const debouncedQ = debouncedTextFindQuery.trim();
                      const findOk = textFindMatcher.mode === "ok";
                      const rowH = textVirtualWindow.rowH;
                  return (
                        <div key={i} className="flex items-stretch" style={{ height: rowH }}>
                          <div className="flex w-12 shrink-0 items-center justify-end border-r bg-muted/40 pr-2 text-[11px] leading-none text-muted-foreground">
                        {i + 1}
                      </div>
                          <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden px-3 py-0.5 text-xs leading-[22px]">
                            <ArchivePlainTextLine
                              line={line}
                              combinedRev={combinedRev}
                              findKind={textFindKind}
                              findQuery={debouncedQ}
                              findMarkActive={findOk && textMatchSet.has(i)}
                            />
                          </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      <Dialog
        open={ifaceDetailModalOpen}
        onOpenChange={(open) => {
          setIfaceDetailModalOpen(open);
        }}
      >
        <DialogContent className="flex max-h-[min(32rem,85vh)] max-w-lg flex-col gap-0 overflow-hidden sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle className="pr-8 font-mono text-base leading-snug font-semibold break-words">
              {ifaceDetailEntry
                ? `${ifaceDetailEntry.id} - ${ifaceDetailEntry.name || "—"}`
                : ""}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {ifaceDetailEntry
                ? `Interface ${ifaceDetailEntry.id}, ${ifaceDetailEntry.name || "unnamed"}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
            <p className="mb-3 text-sm">
              <span className="font-medium tabular-nums text-foreground">{ifaceDetailSubRows.length}</span>{" "}
              <span className="text-muted-foreground">
                component{ifaceDetailSubRows.length === 1 ? "" : "s"} in Interface
              </span>
            </p>
            {ifaceDetailSubRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No component entries in extras for this interface.</p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b hover:bg-transparent">
                      <TableHead className="w-12 font-mono text-xs">#</TableHead>
                      <TableHead className="font-mono text-xs">Name</TableHead>
                      <TableHead className="w-32 font-mono text-xs">ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ifaceDetailSubRows.map((row, idx) => (
                      <TableRow key={row.childId} className="hover:bg-muted/40">
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell
                          className="min-w-0 break-words font-mono text-xs"
                          data-col-key="gameval"
                          onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)}
                        >
                          {row.label || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">{row.combinedId}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
    </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dbTableDetailModalOpen}
        onOpenChange={(open) => {
          setDbTableDetailModalOpen(open);
        }}
      >
        <DialogContent className="flex max-h-[min(40rem,90vh)] w-[min(calc(100vw-2rem),56rem)] max-w-[min(calc(100vw-2rem),56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[56rem]">
          <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
            <DialogTitle className="pr-8 font-mono text-base leading-snug font-semibold break-words">
              {dbTableDetailEntry ? `${dbTableDetailEntry.id} - ${dbTableDetailEntry.name || "—"}` : ""}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {dbTableDetailEntry
                ? `DB table ${dbTableDetailEntry.id}, ${dbTableDetailEntry.name || "unnamed"}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:min-h-[16rem]">
            <div className="grid shrink-0 grid-cols-2 gap-0 border-b border-border bg-muted/25 px-3 py-2.5 sm:px-5">
              <div className="min-w-0 border-r border-border pr-2 sm:pr-3">
                <p className="text-sm leading-tight">
                  <span className="font-medium tabular-nums text-foreground">{dbTableDetailSubRows.length}</span>{" "}
                  <span className="text-muted-foreground">
                    column{dbTableDetailSubRows.length === 1 ? "" : "s"}
                  </span>
                </p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Table schema from{" "}
                  <code className="rounded bg-muted/80 px-1 font-mono text-[10px] text-foreground/90">sub</code> map
                </p>
              </div>
              <div className="min-w-0 pl-2 sm:pl-3">
                <p className="text-sm font-medium leading-tight text-foreground">Related DB rows</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Name prefix{" "}
                  <span className="font-mono text-foreground">{(dbTableDetailEntry?.name ?? "").trim() || "—"}_</span>
                </p>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border overflow-hidden md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden px-3 pb-3 pt-2 sm:px-5 sm:pb-4 sm:pt-3">
                <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                  {dbTableDetailSubRows.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No column entries in extras for this DB table.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b hover:bg-transparent">
                          <TableHead className="w-10 font-mono text-xs">#</TableHead>
                          <TableHead className="font-mono text-xs">Column</TableHead>
                          <TableHead className="w-24 font-mono text-xs">ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dbTableDetailSubRows.map((row, idx) => (
                          <TableRow key={row.columnId} className="hover:bg-muted/40">
                            <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell
                              className="min-w-0 break-words font-mono text-xs"
                              data-col-key="gameval"
                              onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)}
                            >
                              {row.label || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs tabular-nums">{row.combinedId}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden px-3 pb-3 pt-2 sm:px-5 sm:pb-4 sm:pt-3">
                <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                  {!hasLoaded("dbrows", combinedRev) ? (
                    <p className="p-3 text-sm text-muted-foreground">Loading dbrows…</p>
                  ) : dbTableDetailRelatedRows.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      {(dbTableDetailEntry?.name ?? "").trim()
                        ? "No dbrows entries match this prefix."
                        : "This table has no name; cannot match dbrows by prefix."}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b hover:bg-transparent">
                          <TableHead className="w-10 font-mono text-xs">#</TableHead>
                          <TableHead className="font-mono text-xs">Name</TableHead>
                          <TableHead className="w-24 font-mono text-xs">ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dbTableDetailRelatedRows.map((row, idx) => (
                          <TableRow key={row.id} className="hover:bg-muted/40">
                            <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell
                              className="min-w-0 break-words font-mono text-xs"
                              data-col-key="gameval"
                              onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)}
                            >
                              {row.name || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs tabular-nums">{row.id}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
