"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  HelpCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCacheType } from "@/context/cache-type-context";
import { useGamevals } from "@/context/gameval-context";
import {
  diffCacheOrderedPair,
  diffConfigSchemaUrl,
  diffConfigTableUrl,
  type CacheTarget,
} from "@/lib/cache-api-client";
import { conditionalJsonFetchAwaitingDecode } from "@/lib/diff-decode";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";
import { cn } from "@/lib/utils";
import type { GamevalType } from "@/context/gameval-context";

import { sectionGamevalTypeForSection, sectionPrefixForConfigType } from "./diff-constants";
import { useDiffExplorerFocus } from "./diff-explorer-focus";
import { DESCRIBE_SEARCH_EXAMPLES, describeToQuery } from "./diff-describe-to-query";
import {
  extractQueryFromType,
  getCachedDumpFields,
  parseDumpFieldsPayload,
  setCachedDumpFields,
} from "./diff-query-field-manifest";
import {
  applyQuerySuggestion,
  getQuerySuggestState,
  QUERY_PLACEHOLDER,
  QUERY_TRY_EXAMPLES,
  REGEX_TRY_EXAMPLES,
  TEXT_TRY_EXAMPLES,
  type QuerySuggestItem,
  type QuerySuggestState,
} from "./diff-query-suggest";
import { DiffArchiveTable } from "./diff-archive-table";
import {
  DIFF_ARCHIVE_TABLE_CELL_CLASS,
  DIFF_ARCHIVE_TABLE_HEAD_CLASS,
  DIFF_ARCHIVE_TABLE_HEADER_CLASS,
} from "./diff-table-archive-styles";

export type SearchAllMode = "describe" | "text" | "regex" | "query";

type DiffSearchAllPanelProps = {
  section: string;
  sectionLabel?: string;
  baseRev: number;
  rev: number;
  lineCountHint?: number | null;
  /** Switch the viewer to this config type when a search hit is revealed. */
  onNavigateSection?: (configType: string) => void;
  onClose?: () => void;
  className?: string;
};

type ParsedSelectQuery = {
  columns: string[];
  from: string;
  where: string | null;
};

type SearchRow = {
  id: number;
  entries: Record<string, string>;
};

function mapFromAlias(from: string): string {
  const f = from.trim().toLowerCase();
  if (f === "obj" || f === "object" || f === "item" || f === "items") return "items";
  if (f === "npc" || f === "npcs") return "npcs";
  if (f === "loc" || f === "locs" || f === "location" || f === "locations" || f === "objects") return "objects";
  if (f === "if" || f === "interface" || f === "interfaces") return "interfaces";
  if (f === "inv" || f === "inventory" || f === "inventories") return "inv";
  if (f === "sprites" || f === "textures" || f === "gamevals") return "items";
  return f;
}

/** Dump-style FROM alias shown in the query box. */
function displayFromAlias(apiType: string): string {
  const t = mapFromAlias(apiType);
  if (t === "items") return "obj";
  if (t === "objects") return "loc";
  if (t === "interfaces") return "if";
  return t;
}

function parseSelectQuery(raw: string): ParsedSelectQuery | null {
  const q = raw.trim().replace(/\s+/g, " ");
  if (!q) return null;

  const selectMatch = q.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
  if (selectMatch) {
    const colsRaw = selectMatch[1]!.trim();
    const columns =
      colsRaw === "*"
        ? ["_header", "name", "id"]
        : colsRaw.split(",").map((c) => c.trim()).filter(Boolean);
    return {
      columns,
      from: mapFromAlias(selectMatch[2]!),
      where: selectMatch[3]?.trim() || null,
    };
  }

  const fromMatch = q.match(/^FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
  if (fromMatch) {
    return {
      columns: ["_header", "name", "id"],
      from: mapFromAlias(fromMatch[1]!),
      where: fromMatch[2]?.trim() || null,
    };
  }

  // Bare text / describe leftover → search current scope by name/text
  return {
    columns: ["_header", "name", "id"],
    from: "items",
    where: `text CONTAINS ${JSON.stringify(q)}`,
  };
}

function whereToServerQuery(where: string | null): { q?: string; mode?: string } {
  if (!where) return {};
  const nameEq = where.match(/\bname\s*=\s*(".*?"|'.*?'|\S+)/i);
  if (nameEq) {
    return { q: nameEq[1]!.replace(/^["']|["']$/g, ""), mode: "name" };
  }
  const nameContains = where.match(/\bname\s+CONTAINS\s+(".*?"|'.*?'|\S+)/i);
  if (nameContains) {
    return { q: nameContains[1]!.replace(/^["']|["']$/g, ""), mode: "name" };
  }
  const gamevalContains = where.match(/\b(?:gameval|_header)\s+CONTAINS\s+(".*?"|'.*?'|\S+)/i);
  if (gamevalContains) {
    return { q: gamevalContains[1]!.replace(/^["']|["']$/g, ""), mode: "gameval" };
  }
  const textContains = where.match(/\btext\s+CONTAINS\s+(".*?"|'.*?'|\S+)/i);
  if (textContains) {
    return { q: textContains[1]!.replace(/^["']|["']$/g, ""), mode: "name" };
  }
  const anyContains = where.match(/\b\w+\s+CONTAINS\s+(".*?"|'.*?'|\S+)/i);
  if (anyContains) {
    return { q: anyContains[1]!.replace(/^["']|["']$/g, ""), mode: "name" };
  }
  return {};
}

function rowMatchesWhere(row: SearchRow, where: string | null): boolean {
  if (!where) return true;
  const parts = where.split(/\s+AND\s+/i).map((p) => p.trim()).filter(Boolean);
  return parts.every((part) => {
    const eq = part.match(/^(\w+)\s*=\s*(.+)$/i);
    if (eq) {
      const field = eq[1]!.toLowerCase();
      const want = eq[2]!.replace(/^["']|["']$/g, "").toLowerCase();
      if (field === "id") return String(row.id) === want;
      const got = (row.entries[field] ?? "").toLowerCase();
      const norm = (v: string) =>
        v === "yes" || v === "true" || v === "1" ? "true" : v === "no" || v === "false" || v === "0" ? "false" : v;
      return norm(got) === norm(want) || got === want;
    }
    const contains = part.match(/^(_?\w+)\s+CONTAINS\s+(.+)$/i);
    if (contains) {
      const field = contains[1]!.toLowerCase();
      const needle = contains[2]!.replace(/^["']|["']$/g, "").toLowerCase();
      if (field === "text") {
        return (
          String(row.id).includes(needle) ||
          Object.values(row.entries).some((v) => v.toLowerCase().includes(needle))
        );
      }
      if (field === "gameval" || field === "_header" || field === "header") {
        return (
          (row.entries.gameval ?? "").toLowerCase().includes(needle) ||
          (row.entries._header ?? "").toLowerCase().includes(needle)
        );
      }
      return (row.entries[field] ?? "").toLowerCase().includes(needle);
    }
    const gt = part.match(/^(\w+)\s*>\s*(-?\d+)/i);
    if (gt) {
      const n = Number((row.entries[gt[1]!.toLowerCase()] ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) && n > Number(gt[2]);
    }
    return true;
  });
}

function rowHaystack(row: SearchRow): string {
  return [String(row.id), ...Object.values(row.entries)].join("\n");
}

function rowMatchesText(row: SearchRow, needle: string, matchCase: boolean): boolean {
  if (!needle) return true;
  const hay = rowHaystack(row);
  if (matchCase) return hay.includes(needle);
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function rowMatchesRegex(row: SearchRow, pattern: string, matchCase: boolean): { ok: true; match: boolean } | { ok: false; error: string } {
  const raw = pattern.trim();
  if (!raw) return { ok: true, match: true };
  try {
    const re = new RegExp(raw, matchCase ? "" : "i");
    return { ok: true, match: re.test(rowHaystack(row)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid regex" };
  }
}

async function fetchMappedRows(opts: {
  selectedCacheType: CacheTarget;
  from: string;
  pair: { base: number; rev: number };
  q?: string;
  mode?: string;
  lookupGameval: (type: GamevalType, id: number, rev?: number | "latest") => string | undefined;
}): Promise<SearchRow[]> {
  const url = diffConfigTableUrl(opts.selectedCacheType, opts.from, {
    ...opts.pair,
    offset: 0,
    limit: 200,
    q: opts.q,
    mode: opts.mode,
  });
  const key = `diff:search-all:${opts.selectedCacheType.ip}:${opts.selectedCacheType.port}:${opts.from}:${opts.pair.base}:${opts.pair.rev}:${opts.mode ?? ""}:${opts.q ?? ""}`;
  const { data } = await conditionalJsonFetchAwaitingDecode<Record<string, unknown>>(key, url, {
    cacheType: opts.selectedCacheType,
  });
  const rawRows = Array.isArray(data?.rows) ? data.rows : [];
  const mapped: SearchRow[] = [];
  for (const raw of rawRows) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === "number" ? o.id : Number(o.id);
    if (!Number.isFinite(id)) continue;
    const entries: Record<string, string> = {};
    const entryObj =
      o.entries && typeof o.entries === "object" && !Array.isArray(o.entries)
        ? (o.entries as Record<string, unknown>)
        : o.fields && typeof o.fields === "object" && !Array.isArray(o.fields)
          ? (o.fields as Record<string, unknown>)
          : o;
    for (const [k, v] of Object.entries(entryObj)) {
      if (k === "id" || k === "entries" || k === "fields") continue;
      entries[k] = v == null ? "" : String(v);
    }
    const gvType = sectionGamevalTypeForSection(opts.from);
    const header =
      (gvType ? opts.lookupGameval(gvType, id, Math.max(opts.pair.base, opts.pair.rev)) : null) ||
      entries.gameval ||
      `${sectionPrefixForConfigType(opts.from)}_${id}`;
    entries._header = header;
    entries.id = String(id);
    mapped.push({ id, entries });
  }
  return mapped;
}

function toSelectQuery(descriptionOrQuery: string, scopeHint: string): string {
  const trimmed = descriptionOrQuery.trim();
  if (/^\s*SELECT\s+/i.test(trimmed) || /^\s*FROM\s+/i.test(trimmed)) return trimmed;
  // Prefer items for free-form describe when scope is broad (All files / Configs).
  const hint =
    scopeHint === "all" || scopeHint === "configs" || scopeHint === "config" ? "items" : scopeHint;
  const fromWhere = describeToQuery(trimmed, hint);
  // Promote FROM … WHERE to SELECT for the Search-all panel.
  const m = fromWhere.match(/^FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
  if (m) {
    const where = m[2] ? ` WHERE ${m[2]}` : "";
    return `SELECT _header, name, id FROM ${displayFromAlias(m[1]!)}${where}`;
  }
  return `SELECT _header, name, id FROM obj WHERE name CONTAINS ${JSON.stringify(trimmed)}`;
}

function bracketTitleForRow(row: SearchRow, from: string): string {
  // Prefer stable gameval (`[human_walk]`) over `type_id` — ids can move across revs.
  const idFallback = `${sectionPrefixForConfigType(from)}_${row.id}`;
  const gameval = (row.entries.gameval ?? "").trim();
  const header = (row.entries._header ?? "").trim();
  const name = gameval || (header && header !== idFallback ? header : "") || idFallback;
  return `[${name}]`;
}

/** Wait this long after last prev/next click before jumping the code/text view. */
const CODE_REVEAL_DEBOUNCE_MS = 280;

export function DiffSearchAllPanel({
  section,
  sectionLabel,
  baseRev,
  rev,
  lineCountHint,
  onNavigateSection,
  onClose,
  className,
}: DiffSearchAllPanelProps) {
  const { selectedCacheType } = useCacheType();
  const { lookupGameval, loadGamevalType } = useGamevals();
  const { requestFocus } = useDiffExplorerFocus();
  const [mode, setMode] = React.useState<SearchAllMode>("query");
  const [describeValue, setDescribeValue] = React.useState("");
  const [findValue, setFindValue] = React.useState("");
  const [queryValue, setQueryValue] = React.useState("");
  const [matchCase, setMatchCase] = React.useState(false);
  const [scope, setScope] = React.useState<"all" | string>("all");
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [columns, setColumns] = React.useState<string[]>(["_header", "name", "id"]);
  const [rows, setRows] = React.useState<SearchRow[]>([]);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [fromLabel, setFromLabel] = React.useState(section);
  const [suggestOpen, setSuggestOpen] = React.useState(true);
  const [suggestActive, setSuggestActive] = React.useState(0);
  const inputWrapRef = React.useRef<HTMLDivElement | null>(null);
  const resultsScrollRef = React.useRef<HTMLDivElement | null>(null);
  const fetchSeq = React.useRef(0);
  const skipRevealRef = React.useRef(true);
  const navigatingFromSearchRef = React.useRef(false);
  /** Debounce delay (ms) for the next code-view jump; 0 = immediate. */
  const codeRevealDelayRef = React.useRef(0);
  const codeRevealTimerRef = React.useRef<number | null>(null);

  const inputValue = mode === "describe" ? describeValue : mode === "query" ? queryValue : findValue;
  const pair = React.useMemo(() => diffCacheOrderedPair(baseRev, rev), [baseRev, rev]);

  const resolveFrom = React.useCallback(() => {
    // Broad scopes default to items until multi-type search exists.
    if (scope === "all" || scope === "configs") return "items";
    return mapFromAlias(scope);
  }, [scope]);

  const cancelPendingCodeReveal = React.useCallback(() => {
    if (codeRevealTimerRef.current != null) {
      window.clearTimeout(codeRevealTimerRef.current);
      codeRevealTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    const gv = sectionGamevalTypeForSection(section);
    if (gv) void loadGamevalType(gv, Math.max(baseRev, rev));
  }, [baseRev, loadGamevalType, rev, section]);

  React.useEffect(() => {
    if (navigatingFromSearchRef.current) {
      navigatingFromSearchRef.current = false;
      return;
    }
    setScope((prev) => (prev === "configs" ? "configs" : "all"));
    setQueryValue("");
    setFindValue("");
    setRows([]);
    setStatus("idle");
    setActiveIdx(0);
    skipRevealRef.current = true;
    cancelPendingCodeReveal();
  }, [cancelPendingCodeReveal, section]);

  const scrollResultsToIdx = React.useCallback((idx: number) => {
    requestAnimationFrame(() => {
      const el = resultsScrollRef.current?.querySelector(
        `[data-result-idx="${idx}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  const focusCodeView = React.useCallback(
    (idx: number, list: SearchRow[], from: string) => {
      const row = list[idx];
      if (!row) return;
      const configType = mapFromAlias(from);
      if (configType !== section) {
        navigatingFromSearchRef.current = true;
        onNavigateSection?.(configType);
      }
      requestFocus(bracketTitleForRow(row, configType));
    },
    [onNavigateSection, requestFocus, section],
  );

  const scheduleCodeReveal = React.useCallback(
    (idx: number, list: SearchRow[], from: string, delayMs: number) => {
      cancelPendingCodeReveal();
      if (delayMs <= 0) {
        focusCodeView(idx, list, from);
        return;
      }
      codeRevealTimerRef.current = window.setTimeout(() => {
        codeRevealTimerRef.current = null;
        focusCodeView(idx, list, from);
      }, delayMs);
    },
    [cancelPendingCodeReveal, focusCodeView],
  );

  React.useEffect(() => () => cancelPendingCodeReveal(), [cancelPendingCodeReveal]);

  const selectResult = React.useCallback(
    (idx: number, opts?: { debounceCode?: boolean }) => {
      skipRevealRef.current = false;
      codeRevealDelayRef.current = opts?.debounceCode ? CODE_REVEAL_DEBOUNCE_MS : 0;
      scrollResultsToIdx(idx);
      if (idx === activeIdx) {
        scheduleCodeReveal(idx, rows, fromLabel, codeRevealDelayRef.current);
        codeRevealDelayRef.current = 0;
        return;
      }
      setActiveIdx(idx);
    },
    [activeIdx, fromLabel, rows, scheduleCodeReveal, scrollResultsToIdx],
  );

  React.useEffect(() => {
    if (skipRevealRef.current) return;
    if (status !== "ok" || rows.length === 0) return;
    const delay = codeRevealDelayRef.current;
    codeRevealDelayRef.current = 0;
    scrollResultsToIdx(activeIdx);
    scheduleCodeReveal(activeIdx, rows, fromLabel, delay);
  }, [activeIdx, fromLabel, rows, scheduleCodeReveal, scrollResultsToIdx, status]);

  const runSelectSearch = React.useCallback(
    async (rawQuery: string) => {
      const parsed = parseSelectQuery(rawQuery);
      if (!parsed) {
        setRows([]);
        setStatus("idle");
        return;
      }
      // Keep explicit FROM from the query; only force items when FROM is missing/invalid later.
      const seq = ++fetchSeq.current;
      skipRevealRef.current = true;
      cancelPendingCodeReveal();
      setStatus("loading");
      setError(null);
      setFromLabel(parsed.from);
      setColumns(parsed.columns);
      setActiveIdx(0);

      try {
        const serverQ = whereToServerQuery(parsed.where);
        const mapped = await fetchMappedRows({
          selectedCacheType,
          from: parsed.from,
          pair,
          q: serverQ.q,
          mode: serverQ.mode,
          lookupGameval,
        });
        if (seq !== fetchSeq.current) return;

        const filtered = mapped.filter((row) => {
          if (!rowMatchesWhere(row, parsed.where)) return false;
          if (!matchCase || !parsed.where) return true;
          const nameEq = parsed.where.match(/\bname\s*=\s*(".*?"|'.*?'|\S+)/i);
          if (!nameEq) return true;
          const want = nameEq[1]!.replace(/^["']|["']$/g, "");
          return (row.entries.name ?? "") === want;
        });

        skipRevealRef.current = filtered.length === 0;
        setRows(filtered);
        setStatus("ok");
      } catch (e) {
        if (seq !== fetchSeq.current) return;
        setRows([]);
        setStatus("error");
        setError(e instanceof Error ? e.message : "Search failed");
      }
    },
    [cancelPendingCodeReveal, lookupGameval, matchCase, pair, selectedCacheType],
  );

  const runFindSearch = React.useCallback(
    async (kind: "text" | "regex", raw: string) => {
      const from = resolveFrom();
      const seq = ++fetchSeq.current;
      skipRevealRef.current = true;
      cancelPendingCodeReveal();
      setStatus("loading");
      setError(null);
      setFromLabel(from);
      setColumns(["_header", "name", "id"]);
      setActiveIdx(0);

      try {
        const needle = raw.trim();
        const mapped = await fetchMappedRows({
          selectedCacheType,
          from,
          pair,
          q: kind === "text" && needle ? needle : undefined,
          mode: kind === "text" && needle ? "name" : undefined,
          lookupGameval,
        });
        if (seq !== fetchSeq.current) return;

        if (kind === "regex") {
          const probe = rowMatchesRegex({ id: 0, entries: {} }, needle, matchCase);
          if (!probe.ok) {
            setRows([]);
            setStatus("error");
            setError(probe.error);
            return;
          }
          const filtered = mapped.filter((row) => {
            const r = rowMatchesRegex(row, needle, matchCase);
            return r.ok && r.match;
          });
          skipRevealRef.current = filtered.length === 0;
          setRows(filtered);
          setStatus("ok");
          return;
        }

        const textFiltered = mapped.filter((row) => rowMatchesText(row, needle, matchCase));
        skipRevealRef.current = textFiltered.length === 0;
        setRows(textFiltered);
        setStatus("ok");
      } catch (e) {
        if (seq !== fetchSeq.current) return;
        setRows([]);
        setStatus("error");
        setError(e instanceof Error ? e.message : "Search failed");
      }
    },
    [cancelPendingCodeReveal, lookupGameval, matchCase, pair, resolveFrom, selectedCacheType],
  );

  const onSearch = React.useCallback(() => {
    if (mode === "describe") {
      const q = toSelectQuery(describeValue, scope);
      setQueryValue(q);
      setMode("query");
      void runSelectSearch(q);
      return;
    }
    if (mode === "query") {
      let q = queryValue.trim();
      if (!/^\s*SELECT\s+/i.test(q) && !/^\s*FROM\s+/i.test(q) && q) {
        q = toSelectQuery(q, scope);
        setQueryValue(q);
      }
      void runSelectSearch(q);
      return;
    }
    void runFindSearch(mode, findValue);
  }, [describeValue, findValue, mode, queryValue, runFindSearch, runSelectSearch, scope]);

  const applyDescribe = React.useCallback(
    (text: string) => {
      setDescribeValue(text);
      const q = toSelectQuery(text, scope);
      setQueryValue(q);
      setMode("query");
      void runSelectSearch(q);
    },
    [runSelectSearch, scope],
  );

  const copyQuery = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mode === "query" ? queryValue : inputValue);
    } catch {
      // ignore
    }
  }, [inputValue, mode, queryValue]);

  const navDisabled = rows.length === 0;
  const displayCols = columns.length > 0 ? columns : ["_header", "name", "id"];

  const queryFromType = React.useMemo(
    () => (mode === "query" ? extractQueryFromType(queryValue) : null),
    [mode, queryValue],
  );
  const [liveDumpFields, setLiveDumpFields] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    if (!queryFromType) {
      setLiveDumpFields(null);
      return;
    }
    const cached = getCachedDumpFields(selectedCacheType.id, queryFromType);
    if (cached) {
      setLiveDumpFields(cached);
      return;
    }
    setLiveDumpFields(null);
    let cancelled = false;
    const url = diffConfigSchemaUrl(selectedCacheType, queryFromType);
    const cacheKey = `diff:config:schema:v2-dumpFields:${selectedCacheType.id}:${queryFromType}`;
    void (async () => {
      try {
        const { data } = await conditionalJsonFetch<unknown>(cacheKey, url);
        if (cancelled) return;
        const dump = parseDumpFieldsPayload(data);
        if (dump) {
          setCachedDumpFields(selectedCacheType.id, queryFromType, dump);
          setLiveDumpFields(dump);
        }
      } catch {
        // leave null — suggestions show loading / empty until retry
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryFromType, selectedCacheType]);

  const querySuggest = React.useMemo((): QuerySuggestState | null => {
    if (mode !== "query") return null;
    return getQuerySuggestState(queryValue, { sourceFields: liveDumpFields });
  }, [liveDumpFields, mode, queryValue]);

  const showQuerySuggest = Boolean(suggestOpen && querySuggest && querySuggest.items.length > 0);

  React.useEffect(() => {
    setSuggestActive(0);
  }, [querySuggest?.kind, querySuggest?.filter, queryValue]);

  React.useEffect(() => {
    if (!showQuerySuggest) return;
    const onDoc = (e: MouseEvent) => {
      if (!inputWrapRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showQuerySuggest]);

  const applySuggestItem = React.useCallback(
    (item: QuerySuggestItem) => {
      if (!querySuggest) return;
      const next = applyQuerySuggestion(queryValue, item, querySuggest.kind);
      setQueryValue(next);
      setSuggestOpen(true);
      setSuggestActive(0);
    },
    [querySuggest, queryValue],
  );

  const placeholder =
    mode === "describe"
      ? "Describe what you want to find in ordinary language…"
      : mode === "text"
        ? "Search text across names and fields…"
        : mode === "regex"
          ? "Regular expression (e.g. Rune\\s+dart)"
          : QUERY_PLACEHOLDER;

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden border-t bg-card", className)}>
      <div className="flex shrink-0 flex-col gap-1.5 border-b px-2 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <div className="flex shrink-0 items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Search className="size-3.5 text-sky-500" aria-hidden />
            <span className="font-medium text-foreground/90">Search all</span>
          </div>

          <select
            value={mode}
            onChange={(e) => {
              const next = e.target.value as SearchAllMode;
              setMode(next);
              if (next === "query") setSuggestOpen(true);
            }}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label="Search mode"
          >
            <option value="describe">Describe</option>
            <option value="text">Text</option>
            <option value="regex">Regex</option>
            <option value="query">Query</option>
          </select>

          <div ref={inputWrapRef} className="relative flex min-w-[12rem] flex-1 flex-col">
            <div className="relative flex w-full items-center">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (mode === "describe") setDescribeValue(v);
                  else if (mode === "query") {
                    setQueryValue(v);
                    setSuggestOpen(true);
                  } else setFindValue(v);
                }}
                onFocus={() => {
                  if (mode === "query") setSuggestOpen(true);
                }}
                onKeyDown={(e) => {
                  if (showQuerySuggest && querySuggest) {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setSuggestActive((i) => (i + 1) % querySuggest.items.length);
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setSuggestActive((i) => (i - 1 + querySuggest.items.length) % querySuggest.items.length);
                      return;
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const pick = querySuggest.items[suggestActive];
                      if (pick) applySuggestItem(pick);
                      return;
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setSuggestOpen(false);
                      return;
                    }
                    if (e.key === "Tab" && querySuggest.items[suggestActive]) {
                      e.preventDefault();
                      applySuggestItem(querySuggest.items[suggestActive]!);
                      return;
                    }
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSearch();
                  }
                }}
                placeholder={placeholder}
                className={cn(
                  "h-7 w-full rounded-md border border-border bg-background py-1 pl-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  mode === "describe" ? "pr-16 font-sans" : mode === "text" ? "pr-2 font-sans" : "pr-2 font-mono",
                )}
              />
              {mode === "describe" ? (
                <button
                  type="button"
                  title="Turn description into a query"
                  className="absolute right-1 top-1/2 inline-flex h-5 -translate-y-1/2 items-center gap-0.5 rounded bg-violet-600/90 px-1.5 text-[10px] font-semibold text-white hover:bg-violet-500"
                  onClick={() => {
                    const q = toSelectQuery(describeValue, scope);
                    setQueryValue(q);
                    setMode("query");
                  }}
                >
                  <Sparkles className="size-3" aria-hidden />
                  AI
                </button>
              ) : null}
            </div>

            {showQuerySuggest && querySuggest ? (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] overflow-hidden rounded-md border border-border bg-popover shadow-lg">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                  <span>{querySuggest.header}</span>
                  <span className="tabular-nums">{querySuggest.items.length} matches</span>
                </div>
                <ul className="max-h-56 overflow-auto py-1" role="listbox">
                  {querySuggest.items.map((item, idx) => (
                    <li key={`${item.badge}-${item.value}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={idx === suggestActive}
                        className={cn(
                          "flex w-full items-center gap-2 px-2.5 py-1.5 text-left",
                          idx === suggestActive ? "bg-sky-500/20" : "hover:bg-muted/50",
                        )}
                        onMouseEnter={() => setSuggestActive(idx)}
                        onClick={() => applySuggestItem(item)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-xs font-semibold text-foreground">{item.value}</span>
                          <span className="block text-[11px] text-muted-foreground">{item.detail}</span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            item.badge === "SOURCE"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : item.badge === "KEYWORD"
                                ? "border border-sky-500/60 bg-sky-500/10 text-sky-300"
                                : "bg-violet-500/20 text-violet-300",
                          )}
                        >
                          {item.badge}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <select
            value={scope === "configs" ? "configs" : "all"}
            onChange={(e) => setScope(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs outline-none"
            aria-label="Search scope"
          >
            <option value="all">All files</option>
            <option value="configs">Configs</option>
          </select>

          <Button
            type="button"
            size="xs"
            variant={matchCase ? "secondary" : "outline"}
            className="h-7 min-w-7 px-1.5 font-semibold"
            aria-pressed={matchCase}
            title="Match case"
            onClick={() => setMatchCase((v) => !v)}
          >
            Aa
          </Button>

          <Button type="button" size="xs" className="h-7 bg-sky-600 px-3 text-white hover:bg-sky-500" onClick={onSearch}>
            Search
          </Button>

          <Button type="button" size="icon-xs" variant="outline" className="h-7 w-7" title="Copy query" onClick={() => void copyQuery()}>
            <Copy className="size-3.5" />
          </Button>
          <Button type="button" size="icon-xs" variant="outline" className="h-7 w-7" title="Help" disabled>
            <HelpCircle className="size-3.5" />
          </Button>

          <span className="min-w-6 text-center text-xs tabular-nums text-muted-foreground">
            {status === "ok" ? rows.length : "—"}
          </span>
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            className="h-7 w-7"
            disabled={navDisabled}
            title="Previous result"
            onClick={() => selectResult((activeIdx - 1 + rows.length) % rows.length, { debounceCode: true })}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="outline"
            className="h-7 w-7"
            disabled={navDisabled}
            title="Next result"
            onClick={() => selectResult((activeIdx + 1) % rows.length, { debounceCode: true })}
          >
            <ChevronDown className="size-3.5" />
          </Button>
          {onClose ? (
            <Button type="button" size="icon-xs" variant="outline" className="h-7 w-7" title="Close search" onClick={onClose}>
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>

        {mode === "describe" ? (
          <div className="flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
            <span>Try describing</span>
            {DESCRIBE_SEARCH_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-md border border-border/80 bg-background/70 px-2 py-0.5 font-mono text-[11px] text-foreground/90 hover:bg-muted"
                onClick={() => applyDescribe(example)}
              >
                {example}
              </button>
            ))}
          </div>
        ) : !showQuerySuggest ? (
          <div className="flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
            <span>Try a search</span>
            {(mode === "query"
              ? QUERY_TRY_EXAMPLES
              : mode === "regex"
                ? REGEX_TRY_EXAMPLES
                : TEXT_TRY_EXAMPLES
            ).map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-md border border-border/80 bg-background/70 px-2 py-0.5 font-mono text-[11px] text-foreground/90 hover:bg-muted"
                onClick={() => {
                  if (mode === "query") {
                    setQueryValue(example);
                    setSuggestOpen(false);
                    void runSelectSearch(
                      /^\s*SELECT\s+/i.test(example) || /^\s*FROM\s+/i.test(example)
                        ? example
                        : toSelectQuery(example, scope),
                    );
                    return;
                  }
                  setFindValue(example);
                  void runFindSearch(mode, example);
                }}
              >
                {example}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div ref={resultsScrollRef} className="min-h-0 flex-1 overflow-auto">
        {status === "loading" ? (
          <div className="space-y-2 p-3" aria-busy="true">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" delayMs={40} />
            <Skeleton className="h-8 w-full" delayMs={80} />
          </div>
        ) : status === "error" ? (
          <p className="p-3 text-sm text-destructive">{error ?? "Search failed"}</p>
        ) : status === "idle" ? (
          <p className="p-3 text-sm text-muted-foreground">
            Run a search to see results. Describe + AI builds a SELECT; Text/Regex match fields; Query runs dump-style SELECT.
          </p>
        ) : rows.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No rows matched.</p>
        ) : (
          <DiffArchiveTable aria-label="Search results" className="h-full rounded-none border-0">
            <TableHeader className={DIFF_ARCHIVE_TABLE_HEADER_CLASS}>
              <TableRow>
                {displayCols.map((col) => (
                  <TableHead key={col} className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>
                    {col.toUpperCase()}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  data-result-idx={idx}
                  data-active={idx === activeIdx ? "true" : undefined}
                  className={cn(
                    "border-t",
                    idx === activeIdx ? "bg-sky-500/15" : "hover:bg-muted/40",
                  )}
                  onClick={() => selectResult(idx)}
                >
                  {displayCols.map((col) => {
                    const key = col.toLowerCase();
                    const value =
                      col === "id"
                        ? String(row.id)
                        : row.entries[col] ||
                          row.entries[key] ||
                          (key === "weight" ? row.entries.weight || row.entries.Weight || "—" : "—");
                    return (
                      <TableCell key={col} className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono text-xs")}>
                        {value}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </DiffArchiveTable>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t px-2 py-1 text-[10px] text-muted-foreground">
        <span>
          {sectionLabel ?? section}
          {lineCountHint != null ? ` · ${lineCountHint.toLocaleString()} lines` : null}
          {" · "}
          {fromLabel}
        </span>
        <span className="tabular-nums">
          {rows.length > 0 ? `Row ${activeIdx + 1}/${rows.length}` : "No selection"}
          {" · "}
          metadata: cache
        </span>
      </div>
    </div>
  );
}
