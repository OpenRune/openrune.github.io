import type { GamevalType } from "@/context/gameval-context";

import type { ConfigArchiveTableRow, DiffConfigArchiveGamevalBulkFilter } from "./diff-config-archive-types";
import { idQueryMatchesNumericId, looksLikeSpriteIdQueryText } from "./diff-id-search";
import type { DiffSearchFieldMode, SearchTag } from "./diff-types";

type GamevalExtraLike = {
  searchable: string;
  text: string;
  sub: Record<number, string>;
};

type GamevalLookupFns = {
  lookupGameval: (type: GamevalType, id: number, rev?: number | "latest") => string | undefined;
  getGamevalExtra: (type: GamevalType, id: number, rev?: number | "latest") => GamevalExtraLike | undefined;
};

export type ConfigArchiveTableSearchRow = ConfigArchiveTableRow & {
  searchText: string;
  exactTerms: string[];
  filterId: number | null;
};

export type ConfigArchiveTableSearchIndex = {
  rows: ConfigArchiveTableSearchRow[];
  sourceFingerprint: string;
  builtAt: number;
};

const INLINE_GAMEVAL_REF_REGEX = /\b([a-z][a-z0-9_]*)\.([A-Za-z0-9_:$\/-]+)\b/gi;

function safeRegexTest(pattern: string, haystack: string): boolean {
  try {
    const re = new RegExp(pattern, "i");
    re.lastIndex = 0;
    return re.test(haystack);
  } catch {
    return false;
  }
}

function pushLower(out: Set<string>, value: string | undefined | null): void {
  const trimmed = value?.trim().toLowerCase();
  if (trimmed) out.add(trimmed);
}

function extractInlineGamevalTerms(values: readonly string[]): string[] {
  const out = new Set<string>();
  for (const value of values) {
    INLINE_GAMEVAL_REF_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = INLINE_GAMEVAL_REF_REGEX.exec(value)) !== null) {
      pushLower(out, `${match[1]}.${match[2]}`);
    }
  }
  return [...out];
}

function buildBulkSearchTerms(
  row: ConfigArchiveTableRow,
  combinedRev: number,
  gamevalBulkFilter: DiffConfigArchiveGamevalBulkFilter | null,
  fns: GamevalLookupFns,
): { filterId: number | null; exactTerms: string[]; searchParts: string[] } {
  if (!gamevalBulkFilter) {
    return { filterId: null, exactTerms: [], searchParts: [] };
  }

  const filterId = gamevalBulkFilter.rowToFilterId(row);
  if (filterId == null) {
    return { filterId: null, exactTerms: [], searchParts: [] };
  }

  const exactTerms = new Set<string>();
  const searchParts: string[] = [String(filterId)];
  const name = fns.lookupGameval(gamevalBulkFilter.filterGamevalType, filterId, combinedRev);
  const extra = fns.getGamevalExtra(gamevalBulkFilter.filterGamevalType, filterId, combinedRev);

  pushLower(exactTerms, name);
  pushLower(exactTerms, extra?.searchable);
  pushLower(exactTerms, extra?.text);

  if (name) searchParts.push(name);
  if (extra?.searchable) searchParts.push(extra.searchable);
  if (extra?.text) searchParts.push(extra.text);
  for (const value of Object.values(extra?.sub ?? {})) {
    pushLower(exactTerms, value);
    searchParts.push(value);
  }

  return { filterId, exactTerms: [...exactTerms], searchParts };
}

export function buildConfigArchiveTableSearchIndex(
  rows: ConfigArchiveTableRow[],
  opts: {
    combinedRev: number;
    sourceFingerprint: string;
    gamevalBulkFilter: DiffConfigArchiveGamevalBulkFilter | null;
  } & GamevalLookupFns,
): ConfigArchiveTableSearchIndex {
  const docs: ConfigArchiveTableSearchRow[] = rows.map((row) => {
    const entryPairs = Object.entries(row.entries);
    const entryValues = entryPairs.map(([, value]) => String(value ?? ""));
    const entryTerms = extractInlineGamevalTerms(entryValues);
    const bulkTerms = buildBulkSearchTerms(row, opts.combinedRev, opts.gamevalBulkFilter, opts);
    const exactTerms = new Set<string>(entryTerms);
    for (const term of bulkTerms.exactTerms) {
      pushLower(exactTerms, term);
    }

    const searchParts: string[] = [String(row.id)];
    for (const [key, value] of entryPairs) {
      const valueText = String(value ?? "");
      searchParts.push(key);
      searchParts.push(`${key}=${valueText}`);
      searchParts.push(valueText);
    }
    searchParts.push(...bulkTerms.searchParts);
    searchParts.push(...exactTerms);

    return {
      ...row,
      searchText: searchParts.join("\n").toLowerCase(),
      exactTerms: [...exactTerms],
      filterId: bulkTerms.filterId,
    };
  });

  return {
    rows: docs,
    sourceFingerprint: opts.sourceFingerprint,
    builtAt: Date.now(),
  };
}

function matchesGamevalTags(row: ConfigArchiveTableSearchRow, tags: SearchTag[]): boolean {
  return tags.every((tag) => {
    const needle = tag.value.trim().toLowerCase();
    if (!needle) return true;
    if (tag.exact) {
      return row.exactTerms.includes(needle);
    }
    if (row.exactTerms.some((term) => term.includes(needle))) return true;
    return row.searchText.includes(needle);
  });
}

function searchRowMatches(
  row: ConfigArchiveTableSearchRow,
  opts: {
    mode: DiffSearchFieldMode;
    tableQuery: string;
    gamevalTags: SearchTag[];
    gamevalTextFragment: string;
  },
): boolean {
  if (opts.mode === "gameval") {
    if (!matchesGamevalTags(row, opts.gamevalTags)) return false;
    const fragment = opts.gamevalTextFragment.trim();
    if (!fragment) return true;
    if (looksLikeSpriteIdQueryText(fragment)) {
      return (
        idQueryMatchesNumericId(row.id, fragment) ||
        (row.filterId != null && idQueryMatchesNumericId(row.filterId, fragment))
      );
    }
    const needle = fragment.toLowerCase();
    if (row.exactTerms.some((term) => term.includes(needle))) return true;
    return row.searchText.includes(needle);
  }

  const query = opts.tableQuery.trim();
  if (!query) return true;

  if (opts.mode === "id") {
    return idQueryMatchesNumericId(row.id, query);
  }

  if (opts.mode === "name") {
    const needle = query.toLowerCase();
    if (looksLikeSpriteIdQueryText(query)) {
      return idQueryMatchesNumericId(row.id, query) || row.searchText.includes(needle);
    }
    return row.searchText.includes(needle);
  }

  if (opts.mode === "regex") {
    if (looksLikeSpriteIdQueryText(query)) {
      return idQueryMatchesNumericId(row.id, query);
    }
    return safeRegexTest(query, row.searchText);
  }

  return true;
}

export function searchConfigArchiveTableIndex(
  index: ConfigArchiveTableSearchIndex,
  opts: {
    mode: DiffSearchFieldMode;
    tableQuery: string;
    gamevalTags: SearchTag[];
    gamevalTextFragment: string;
  },
): ConfigArchiveTableRow[] {
  return index.rows.filter((row) => searchRowMatches(row, opts)).map(({ searchText: _searchText, exactTerms: _exactTerms, filterId: _filterId, ...row }) => row);
}