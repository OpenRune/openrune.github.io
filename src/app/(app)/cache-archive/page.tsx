"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { OptionDropdown } from "@/components/ui/option-dropdown";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePaginationBar } from "@/components/ui/table-pagination-bar";
import {
  formatBinarySize,
  formatDateInputValue,
  formatDateTime,
  formatDateTimeParts,
  formatNumber,
} from "@/lib/formatting";
import { cn } from "@/lib/utils";

type CacheArchiveRowBase = {
  id: number;
  game: string;
  environment: string;
  timestamp: string;
  builds: Array<{ major: number; minor: number | null }>;
  archives: number | null;
  validArchives: number | null;
  groups: number | null;
  validGroups: number | null;
  keys: number | null;
  validKeys: number | null;
  size: number;
  sources: string[];
};

type CacheArchiveRow = CacheArchiveRowBase & {
  links: {
    details: string;
    disk: string;
    keys: string;
    flatFile: string;
    keysText: string;
    map: string;
  };
  timestampMs: number;
  timestampYear: string | null;
  timestampMonth: string | null;
  timestampDateKey: string | null;
  timestampParts: { date: string; time: string | null };
  maxBuild: number;
};

type CacheArchiveResponse = {
  updatedAt: string;
  rows: ApiCacheArchiveRow[];
};

type ApiCacheArchiveRow = CacheArchiveRowBase & {
  valid_archives?: number | null;
  valid_groups?: number | null;
  valid_keys?: number | null;
  links?: Partial<CacheArchiveRow["links"]>;
};

const GAME_FILTERS = ["all", "darkscape", "dotd", "oldschool", "runescape"] as const;
const ENV_FILTERS = ["all", "live", "beta"] as const;
const MONTH_FILTERS = [
  { value: "1", label: "Jan" },
  { value: "2", label: "Feb" },
  { value: "3", label: "Mar" },
  { value: "4", label: "Apr" },
  { value: "5", label: "May" },
  { value: "6", label: "Jun" },
  { value: "7", label: "Jul" },
  { value: "8", label: "Aug" },
  { value: "9", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
] as const;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
const COLUMN_COUNT = 11;
const VIRTUAL_ROW_HEIGHT = 56;
const VIRTUAL_OVERSCAN = 8;
type SortColumn = "timestamp" | "builds";
type SortDirection = "asc" | "desc";

function formatBuilds(builds: Array<{ major: number; minor: number | null }>): string {
  if (!builds.length) return "—";
  const majors = Array.from(new Set(builds.map((build) => build.major))).sort((a, b) => a - b);
  if (!majors.length) return "—";

  const ranges: string[] = [];
  let start = majors[0];
  let prev = majors[0];

  for (let i = 1; i < majors.length; i += 1) {
    const current = majors[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    ranges.push(start === prev ? String(start) : `${start}-${prev}`);
    start = current;
    prev = current;
  }

  ranges.push(start === prev ? String(start) : `${start}-${prev}`);
  return ranges.join(", ");
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildCacheLinks(id: number, links?: Partial<CacheArchiveRow["links"]>): CacheArchiveRow["links"] {
  return {
    details: links?.details ?? `https://archive.openrs2.org/caches/${id}`,
    disk: links?.disk ?? `https://archive.openrs2.org/caches/runescape/${id}/disk.zip`,
    keys: links?.keys ?? `https://archive.openrs2.org/caches/runescape/${id}/keys.json`,
    flatFile: links?.flatFile ?? `https://archive.openrs2.org/caches/runescape/${id}/flat-file.tar.gz`,
    keysText: links?.keysText ?? `https://archive.openrs2.org/caches/runescape/${id}/keys.zip`,
    map: links?.map ?? `https://archive.openrs2.org/caches/runescape/${id}/map.png`,
  };
}

function parseTimestampMeta(value: string): {
  timestampMs: number;
  timestampYear: string | null;
  timestampMonth: string | null;
  timestampDateKey: string | null;
  timestampParts: { date: string; time: string | null };
} {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      timestampMs: 0,
      timestampYear: null,
      timestampMonth: null,
      timestampDateKey: null,
      timestampParts: { date: value, time: null },
    };
  }
  return {
    timestampMs: date.getTime(),
    timestampYear: String(date.getFullYear()),
    timestampMonth: String(date.getMonth() + 1),
    timestampDateKey: formatDateInputValue(date),
    timestampParts: formatDateTimeParts(value),
  };
}

function normalizeCacheArchiveRow(row: ApiCacheArchiveRow): CacheArchiveRow {
  const timestampMeta = parseTimestampMeta(row.timestamp);
  const maxBuild = row.builds.length ? Math.max(...row.builds.map((build) => build.major)) : -1;
  return {
    ...row,
    archives: toNullableNumber(row.archives),
    validArchives: toNullableNumber(row.validArchives ?? row.valid_archives),
    groups: toNullableNumber(row.groups),
    validGroups: toNullableNumber(row.validGroups ?? row.valid_groups),
    keys: toNullableNumber(row.keys),
    validKeys: toNullableNumber(row.validKeys ?? row.valid_keys),
    size: toNullableNumber(row.size) ?? 0,
    links: buildCacheLinks(row.id, row.links),
    ...timestampMeta,
    maxBuild,
  };
}

function formatCoverage(
  value: number | null,
  total: number | null,
  options?: { zeroTotalMeansFull?: boolean; fractionDigits?: number },
): { ratio: string; percent: string; percentValue: number | null } {
  const safeValue = value ?? 0;
  const safeTotal = total ?? 0;
  const fractionDigits = options?.fractionDigits ?? 1;
  const ratio = `${formatNumber(safeValue)} / ${formatNumber(safeTotal)}`;
  if (safeTotal <= 0) {
    if (options?.zeroTotalMeansFull && safeValue === 0) {
      return {
        ratio,
        percent: `${(100).toFixed(fractionDigits)}%`,
        percentValue: 100,
      };
    }
    return { ratio, percent: "—", percentValue: null };
  }
  const percentage = (safeValue / safeTotal) * 100;
  return { ratio, percent: `${percentage.toFixed(fractionDigits)}%`, percentValue: percentage };
}

function coveragePercentTintClass(percentValue: number | null): string {
  if (percentValue == null) return "text-muted-foreground";
  if (percentValue >= 99) return "text-emerald-500 dark:text-emerald-400";
  if (percentValue >= 90) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function coverageCellTintClass(percentValue: number | null): string {
  if (percentValue == null) return "bg-muted/20";
  if (percentValue >= 99) return "bg-emerald-500/7 dark:bg-emerald-500/12";
  if (percentValue >= 90) return "bg-amber-500/7 dark:bg-amber-500/12";
  return "bg-red-500/7 dark:bg-red-500/12";
}

function CacheArchivePageInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<CacheArchiveRow[]>([]);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);

  const [idFilter, setIdFilter] = React.useState("");
  const [game, setGame] = React.useState<(typeof GAME_FILTERS)[number]>("oldschool");
  const [environment, setEnvironment] = React.useState<(typeof ENV_FILTERS)[number]>("all");
  const [buildFilter, setBuildFilter] = React.useState("");
  const [yearFilter, setYearFilter] = React.useState("all");
  const [monthFilter, setMonthFilter] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState("");
  const [sortColumn, setSortColumn] = React.useState<SortColumn>("timestamp");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [pageSize, setPageSize] = React.useState<(typeof PAGE_SIZE_OPTIONS)[number]>(50);
  const [page, setPage] = React.useState(1);
  const [selectedRow, setSelectedRow] = React.useState<CacheArchiveRow | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const handledDeepLinkRef = React.useRef(false);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/server/cache-archive", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to fetch cache archive: ${response.status}`);
        }
        const json = (await response.json()) as CacheArchiveResponse;
        if (cancelled) return;
        setRows((json.rows ?? []).map(normalizeCacheArchiveRow));
        setUpdatedAt(json.updatedAt ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const yearOptions = React.useMemo(() => {
    const years = Array.from(
      new Set(rows.map((row) => row.timestampYear).filter((year): year is string => Boolean(year))),
    ).sort((a, b) => Number(b) - Number(a));
    return years;
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    const next = rows.filter((row) => {
      if (game !== "all" && row.game !== game) return false;
      if (environment !== "all" && row.environment !== environment) return false;
      if (idFilter.trim()) {
        if (!String(row.id).includes(idFilter.trim())) return false;
      }
      if (buildFilter.trim()) {
        const match = row.builds.some((build) => String(build.major) === buildFilter.trim());
        if (!match) return false;
      }
      if (yearFilter !== "all" || monthFilter !== "all" || dateFilter) {
        if (yearFilter !== "all" && row.timestampYear !== yearFilter) return false;
        if (monthFilter !== "all" && row.timestampMonth !== monthFilter) return false;
        if (dateFilter && row.timestampDateKey !== dateFilter) return false;
      }
      return true;
    });

    next.sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      if (sortColumn === "timestamp") {
        return (a.timestampMs - b.timestampMs) * multiplier;
      }
      return (a.maxBuild - b.maxBuild) * multiplier;
    });

    return next;
  }, [
    rows,
    game,
    environment,
    idFilter,
    buildFilter,
    yearFilter,
    monthFilter,
    dateFilter,
    sortColumn,
    sortDirection,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = React.useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);
  const shouldVirtualize = pageRows.length > 80;
  const totalVirtualHeight = pageRows.length * VIRTUAL_ROW_HEIGHT;
  const virtualStartIndex = shouldVirtualize
    ? Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN)
    : 0;
  const virtualEndIndex = shouldVirtualize
    ? Math.min(
        pageRows.length,
        Math.ceil((scrollTop + viewportHeight) / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN,
      )
    : pageRows.length;
  const visibleRows = shouldVirtualize
    ? pageRows.slice(virtualStartIndex, virtualEndIndex)
    : pageRows;
  const topSpacerHeight = shouldVirtualize ? virtualStartIndex * VIRTUAL_ROW_HEIGHT : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? Math.max(0, totalVirtualHeight - virtualEndIndex * VIRTUAL_ROW_HEIGHT)
    : 0;

  React.useEffect(() => {
    setPage(1);
  }, [
    game,
    environment,
    idFilter,
    buildFilter,
    yearFilter,
    monthFilter,
    dateFilter,
    sortColumn,
    sortDirection,
    pageSize,
  ]);

  React.useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;
    const updateViewport = () => setViewportHeight(element.clientHeight);
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;
    element.scrollTo({ top: 0 });
    setScrollTop(0);
  }, [safePage, pageSize, game, environment, idFilter, buildFilter, yearFilter, monthFilter, dateFilter]);

  React.useEffect(() => {
    const gameParam = searchParams.get("game");
    if (gameParam && GAME_FILTERS.includes(gameParam as (typeof GAME_FILTERS)[number])) {
      setGame(gameParam as (typeof GAME_FILTERS)[number]);
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (handledDeepLinkRef.current || loading || rows.length === 0) return;
    const shouldOpen = searchParams.get("open") === "1";
    const idParam = searchParams.get("id");
    if (!shouldOpen || !idParam) {
      handledDeepLinkRef.current = true;
      return;
    }
    const targetId = Number(idParam);
    if (!Number.isFinite(targetId)) {
      handledDeepLinkRef.current = true;
      return;
    }
    const match = rows.find((row) => row.id === targetId);
    if (match) {
      setSelectedRow(match);
      setDetailsOpen(true);
    }
    handledDeepLinkRef.current = true;
  }, [searchParams, rows, loading]);

  return (
    <div className="mx-auto h-[calc(100dvh-2rem)] w-full max-w-[98rem] overflow-hidden md:h-[calc(100dvh-3rem)]">
      <Card className="flex h-full flex-col">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Cache Archive</CardTitle>
            <Link
              href="https://archive.openrs2.org/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex"
            >
              <Badge variant="outline" className="hover:bg-muted/60">
                Powered by OpenRS2
              </Badge>
            </Link>
            {updatedAt ? (
              <Badge variant="secondary">Last updated {formatDateTime(updatedAt)}</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Search and filter OpenRS2 cache entries across games and environments.
          </p>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
          <div
            ref={scrollContainerRef}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            className="min-h-0 flex-1 overflow-auto rounded-lg border"
          >
            <Table className="table-fixed text-xs [&_tbody_td+td]:border-l [&_tbody_td+td]:border-muted [&_thead_th+th]:border-l [&_thead_th+th]:border-muted">
              <colgroup>
                <col className="w-24" />
                <col className="w-32" />
                <col className="w-24" />
                <col className="w-[9.5rem]" />
                <col className="w-[12.5rem]" />
                <col className="w-[7.5rem]" />
                <col className="w-24" />
                <col className="w-32" />
                <col className="w-24" />
                <col className="w-16" />
                <col className="w-[4.5rem]" />
              </colgroup>
              <TableHeader className="sticky top-0 z-10 bg-muted/95 text-muted-foreground backdrop-blur-xs">
                <TableRow>
                  <TableHead className="p-2 pr-3 text-left font-medium">
                    <div className="flex items-center gap-2">
                      <span>ID</span>
                      <Input
                        value={idFilter}
                        onChange={(e) => setIdFilter(e.target.value)}
                        placeholder="filter"
                        className="h-7 w-20 rounded-lg border-border bg-background px-2 text-xs font-normal dark:border-input dark:bg-input/30"
                        aria-label="Filter by id"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="p-2 pr-3 text-left font-medium">
                    <div className="flex items-center gap-2">
                      <span>Game</span>
                      <OptionDropdown
                        value={game}
                        options={GAME_FILTERS.map((option) => ({
                          value: option,
                          label: option === "all" ? "All games" : option,
                        }))}
                        onChange={(value) => setGame(value as (typeof GAME_FILTERS)[number])}
                        className="w-28"
                        buttonClassName="h-7 px-2 text-xs font-normal"
                        aria-label="Filter by game"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="p-2 pr-3 text-left font-medium">
                    <div className="flex items-center gap-2">
                      <span>Env</span>
                      <OptionDropdown
                        value={environment}
                        options={ENV_FILTERS.map((option) => ({
                          value: option,
                          label: option === "all" ? "All envs" : option,
                        }))}
                        onChange={(value) => setEnvironment(value as (typeof ENV_FILTERS)[number])}
                        className="w-24"
                        buttonClassName="h-7 px-2 text-xs font-normal"
                        aria-label="Filter by environment"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="p-2 pr-3 text-left font-medium">
                    <div className="flex items-center gap-2">
                      <span>Builds</span>
                      <Input
                        value={buildFilter}
                        onChange={(e) => setBuildFilter(e.target.value)}
                        placeholder="major"
                        className="h-7 w-20 rounded-lg border-border bg-background px-2 text-xs font-normal dark:border-input dark:bg-input/30"
                        aria-label="Filter by build major"
                      />
                      <div className="flex flex-col items-center -space-y-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className={cn(
                            "h-4 w-4",
                            sortColumn === "builds" && sortDirection === "asc"
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                          onClick={() => {
                            setSortColumn("builds");
                            setSortDirection("asc");
                          }}
                          aria-label="Sort builds ascending"
                        >
                          <ChevronUp className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className={cn(
                            "h-4 w-4",
                            sortColumn === "builds" && sortDirection === "desc"
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                          onClick={() => {
                            setSortColumn("builds");
                            setSortDirection("desc");
                          }}
                          aria-label="Sort builds descending"
                        >
                          <ChevronDown className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="p-2 pr-3 text-left font-medium">
                    <div className="flex items-center gap-1">
                      <div className="flex items-center gap-1">
                        <span>Timestamp</span>
                        <div className="flex flex-col items-center -space-y-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className={cn(
                              "h-4 w-4",
                              sortColumn === "timestamp" && sortDirection === "asc"
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                            onClick={() => {
                              setSortColumn("timestamp");
                              setSortDirection("asc");
                            }}
                            aria-label="Sort timestamp ascending"
                          >
                            <ChevronUp className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className={cn(
                              "h-4 w-4",
                              sortColumn === "timestamp" && sortDirection === "desc"
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                            onClick={() => {
                              setSortColumn("timestamp");
                              setSortDirection("desc");
                            }}
                            aria-label="Sort timestamp descending"
                          >
                            <ChevronDown className="size-3" />
                          </Button>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={cn(
                            buttonVariants({ variant: "outline", size: "xs" }),
                            "inline-flex items-center px-1.5 font-normal",
                          )}
                          aria-label="Open timestamp filters"
                        >
                          Filter
                          <ChevronDown className="ml-1 size-3.5 opacity-70" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-auto min-w-[17rem] p-2">
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <OptionDropdown
                                value={yearFilter}
                                options={[
                                  { value: "all", label: "All years" },
                                  ...yearOptions.map((year) => ({ value: year, label: year })),
                                ]}
                                onChange={setYearFilter}
                                className="w-full"
                                buttonClassName="h-8 px-2 text-xs font-normal"
                                ariaLabel="Filter timestamp by year"
                              />
                              <OptionDropdown
                                value={monthFilter}
                                options={[
                                  { value: "all", label: "All months" },
                                  ...MONTH_FILTERS.map((month) => ({ value: month.value, label: month.label })),
                                ]}
                                onChange={setMonthFilter}
                                className="w-full"
                                buttonClassName="h-8 px-2 text-xs font-normal"
                                ariaLabel="Filter timestamp by month"
                              />
                            </div>
                            <Input
                              id="timestamp-date-filter"
                              type="date"
                              value={dateFilter}
                              onChange={(e) => setDateFilter(e.target.value)}
                              className="h-8 w-full rounded-lg border-border bg-background px-2 text-xs font-normal dark:border-input dark:bg-input/30"
                              aria-label="Filter timestamp by exact date"
                            />
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableHead>
                  <TableHead className="p-2 text-left font-medium">Sources</TableHead>
                  <TableHead className="border-l-2 border-l-muted-foreground/35 p-2 text-right font-medium">
                    Archives
                  </TableHead>
                  <TableHead className="border-l-2 border-l-muted-foreground/35 p-2 text-right font-medium">
                    Groups
                  </TableHead>
                  <TableHead className="border-x-2 border-x-muted-foreground/35 p-2 text-right font-medium">
                    Keys
                  </TableHead>
                  <TableHead className="p-2 text-right font-medium">Size</TableHead>
                  <TableHead className="p-2 text-left font-medium">Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT} className="p-0">
                      <div
                        className="flex min-h-[min(50vh,20rem)] items-center justify-center py-12"
                        role="status"
                        aria-live="polite"
                      >
                        <Loader2 className="size-8 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                        <span className="sr-only">Loading cache archive</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT} className="p-4 text-center text-destructive">
                      {error}
                    </TableCell>
                  </TableRow>
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMN_COUNT} className="p-4 text-center text-muted-foreground">
                      No cache rows match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {topSpacerHeight > 0 ? (
                      <TableRow className="border-0 hover:bg-transparent">
                        <TableCell colSpan={COLUMN_COUNT} className="h-0 p-0" style={{ height: topSpacerHeight }} />
                      </TableRow>
                    ) : null}
                    {visibleRows.map((row) => {
                    const archivesValid = row.validArchives ?? row.archives;
                    const groupsValid = row.validGroups ?? row.groups;
                    const keysValid = row.validKeys ?? null;
                    const archivesCoverage = formatCoverage(archivesValid, row.archives);
                    const groupsCoverage = formatCoverage(groupsValid, row.groups);
                    const keysCoverage = formatCoverage(keysValid, row.keys, {
                      zeroTotalMeansFull: true,
                    });
                    const timestampParts = row.timestampParts;

                      return (
                      <TableRow
                        key={row.id}
                        className="border-t align-top hover:bg-muted/35 focus-visible:bg-muted/35"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedRow(row);
                          setDetailsOpen(true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedRow(row);
                            setDetailsOpen(true);
                          }
                        }}
                      >
                        <TableCell className="p-2 font-mono">{row.id}</TableCell>
                        <TableCell className="p-2 truncate">{row.game}</TableCell>
                        <TableCell className="p-2 truncate">{row.environment}</TableCell>
                        <TableCell className="p-2 truncate font-mono">
                          {formatBuilds(row.builds)}
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="whitespace-nowrap">{timestampParts.date}</div>
                          {timestampParts.time ? (
                            <div className="text-[11px] text-muted-foreground">
                              {timestampParts.time}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="p-2 truncate">
                          {row.sources.length ? row.sources.join(", ") : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "border-l-2 border-l-muted-foreground/30 overflow-hidden p-2 text-right font-mono",
                            coverageCellTintClass(archivesCoverage.percentValue),
                          )}
                        >
                          <div className="inline-flex flex-col items-end rounded-sm bg-background/55 px-1.5 py-0.5">
                            <div className="max-w-full truncate whitespace-nowrap">
                              {archivesCoverage.ratio}
                            </div>
                            <div
                              className={cn(
                                "max-w-full truncate text-[11px]",
                                coveragePercentTintClass(archivesCoverage.percentValue),
                              )}
                            >
                              {archivesCoverage.percent}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "border-l-2 border-l-muted-foreground/30 overflow-hidden p-2 text-right font-mono",
                            coverageCellTintClass(groupsCoverage.percentValue),
                          )}
                        >
                          <div className="inline-flex flex-col items-end rounded-sm bg-background/55 px-1.5 py-0.5">
                            <div className="max-w-full truncate whitespace-nowrap">
                              {groupsCoverage.ratio}
                            </div>
                            <div
                              className={cn(
                                "max-w-full truncate text-[11px]",
                                coveragePercentTintClass(groupsCoverage.percentValue),
                              )}
                            >
                              {groupsCoverage.percent}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "border-x-2 border-x-muted-foreground/30 overflow-hidden p-2 text-right font-mono",
                            coverageCellTintClass(keysCoverage.percentValue),
                          )}
                        >
                          <div className="inline-flex flex-col items-end rounded-sm bg-background/55 px-1.5 py-0.5">
                            <div className="max-w-full truncate whitespace-nowrap">
                              {keysCoverage.ratio}
                            </div>
                            <div
                              className={cn(
                                "max-w-full truncate text-[11px]",
                                coveragePercentTintClass(keysCoverage.percentValue),
                              )}
                            >
                              {keysCoverage.percent}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="p-2 text-right font-mono">
                          {formatBinarySize(row.size)}
                        </TableCell>
                        <TableCell className="p-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className={cn(
                                buttonVariants({ variant: "outline", size: "xs" }),
                                "inline-flex items-center px-1.5",
                              )}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Open links for cache ${row.id}`}
                            >
                              Open
                              <ChevronDown className="ml-1 size-3.5 opacity-70" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-32">
                              <DropdownMenuItem
                                render={
                                  <Link href={row.links.details} target="_blank" rel="noreferrer">
                                    <span className="flex items-center gap-1.5">
                                      Details <ExternalLink className="size-3.5" />
                                    </span>
                                  </Link>
                                }
                              />
                              <DropdownMenuItem
                                render={
                                  <Link href={row.links.disk} target="_blank" rel="noreferrer">
                                    <span className="flex items-center gap-1.5">
                                      Disk <ExternalLink className="size-3.5" />
                                    </span>
                                  </Link>
                                }
                              />
                              <DropdownMenuItem
                                render={
                                  <Link href={row.links.keys} target="_blank" rel="noreferrer">
                                    <span className="flex items-center gap-1.5">
                                      Keys <ExternalLink className="size-3.5" />
                                    </span>
                                  </Link>
                                }
                              />
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                    {bottomSpacerHeight > 0 ? (
                      <TableRow className="border-0 hover:bg-transparent">
                        <TableCell colSpan={COLUMN_COUNT} className="h-0 p-0" style={{ height: bottomSpacerHeight }} />
                      </TableRow>
                    ) : null}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          <TablePaginationBar
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={(value) => setPageSize(value as (typeof PAGE_SIZE_OPTIONS)[number])}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            showingCount={pageRows.length}
            totalCount={filteredRows.length}
            countLabel="rows"
          />
        </CardContent>
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-xl">
          {selectedRow ? (
            <>
              <DialogHeader>
                <DialogTitle>Cache {selectedRow.id}</DialogTitle>
                <DialogDescription>
                  {selectedRow.game} / {selectedRow.environment} / {formatBuilds(selectedRow.builds)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                {(() => {
                  const archivesCoverage = formatCoverage(
                    selectedRow.validArchives ?? selectedRow.archives,
                    selectedRow.archives,
                    { fractionDigits: 2 },
                  );
                  const groupsCoverage = formatCoverage(
                    selectedRow.validGroups ?? selectedRow.groups,
                    selectedRow.groups,
                    { fractionDigits: 2 },
                  );
                  const keysCoverage = formatCoverage(selectedRow.validKeys ?? null, selectedRow.keys, {
                    zeroTotalMeansFull: true,
                    fractionDigits: 2,
                  });

                  return (
                    <div className="grid gap-2 rounded-md border bg-muted/30 p-3 font-mono text-xs sm:grid-cols-[6rem_1fr]">
                      <div className="text-muted-foreground">Archives</div>
                      <div>{archivesCoverage.ratio + " (" + archivesCoverage.percent + ")"}</div>
                      <div className="text-muted-foreground">Groups</div>
                      <div>{groupsCoverage.ratio + " (" + groupsCoverage.percent + ")"}</div>
                      <div className="text-muted-foreground">Keys</div>
                      <div>{keysCoverage.ratio + " (" + keysCoverage.percent + ")"}</div>
                      <div className="text-muted-foreground">Size</div>
                      <div>{formatBinarySize(selectedRow.size)}</div>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Download</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Link
                    href={selectedRow.links.disk}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Cache (.dat2/.idx)
                  </Link>
                  <Link
                    href={selectedRow.links.flatFile}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Flat file
                  </Link>
                  <Link
                    href={selectedRow.links.keys}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Keys JSON
                  </Link>
                  <Link
                    href={selectedRow.links.keysText}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Keys Text
                  </Link>
                  <Link
                    href={selectedRow.links.map}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Map PNG
                  </Link>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CacheArchivePageFallback() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      Loading cache archive…
    </div>
  );
}

export default function CacheArchivePage() {
  return (
    <React.Suspense fallback={<CacheArchivePageFallback />}>
      <CacheArchivePageInner />
    </React.Suspense>
  );
}
