/**
 * Autocomplete for dump-style Search-all Query mode.
 * Progressive: KEYWORD (FROM/SELECT) → FIELD / SOURCE → WHERE …
 * Field lists come from the per-type manifest (and live dumpFields when available).
 */

import {
  extractQueryFromType,
  GENERIC_QUERY_FIELDS,
  resolveQueryConfigType,
} from "./diff-query-field-manifest";

export type QuerySuggestKind = "start" | "select" | "from" | "where";

export type QuerySuggestBadge = "KEYWORD" | "FIELD" | "SOURCE";

export type QuerySuggestItem = {
  value: string;
  detail: string;
  badge: QuerySuggestBadge;
};

export type QuerySuggestState = {
  kind: QuerySuggestKind;
  header: string;
  filter: string;
  items: QuerySuggestItem[];
};

export type QuerySuggestOptions = {
  /** Live dump field names for the current FROM source (from `/props`). */
  sourceFields?: readonly string[] | null;
};

const START_KEYWORDS: QuerySuggestItem[] = [
  {
    value: "FROM",
    detail: "Query records with the default result columns",
    badge: "KEYWORD",
  },
  {
    value: "SELECT",
    detail: "Choose result columns before selecting a source",
    badge: "KEYWORD",
  },
];

const WHERE_KEYWORD: QuerySuggestItem = {
  value: "WHERE",
  detail: "Filter matching records",
  badge: "KEYWORD",
};

const FROM_KEYWORD: QuerySuggestItem = {
  value: "FROM",
  detail: "Choose a record source",
  badge: "KEYWORD",
};

const FROM_SOURCES: QuerySuggestItem[] = [
  { value: "obj", detail: "items config dump", badge: "SOURCE" },
  { value: "npc", detail: "npcs config dump", badge: "SOURCE" },
  { value: "loc", detail: "objects config dump", badge: "SOURCE" },
  { value: "if", detail: "interfaces config dump", badge: "SOURCE" },
  { value: "inv", detail: "inventories config dump", badge: "SOURCE" },
  { value: "spotanim", detail: "spotanims config dump", badge: "SOURCE" },
  { value: "seq", detail: "sequences config dump", badge: "SOURCE" },
  { value: "enum", detail: "enums config dump", badge: "SOURCE" },
  { value: "varbit", detail: "varbits config dump", badge: "SOURCE" },
  { value: "varp", detail: "varps config dump", badge: "SOURCE" },
  { value: "param", detail: "params config dump", badge: "SOURCE" },
  { value: "overlay", detail: "overlays config dump", badge: "SOURCE" },
  { value: "underlay", detail: "underlays config dump", badge: "SOURCE" },
  { value: "struct", detail: "structs config dump", badge: "SOURCE" },
  { value: "mapelement", detail: "map elements config dump", badge: "SOURCE" },
  { value: "healthbar", detail: "healthbars config dump", badge: "SOURCE" },
  { value: "varclient", detail: "varcs config dump", badge: "SOURCE" },
];

function fieldItems(fields: readonly string[], detail: string): QuerySuggestItem[] {
  return fields.map((value) => ({
    value,
    detail,
    badge: "FIELD" as const,
  }));
}

function resolveFieldsForSource(
  sourceRaw: string | null,
  liveFields?: readonly string[] | null,
): { type: string | null; fields: readonly string[] } {
  const type = resolveQueryConfigType(sourceRaw);
  if (liveFields && liveFields.length > 0) {
    return { type, fields: liveFields };
  }
  // No FROM yet → tiny generic SELECT list. With FROM but fields still loading → empty.
  if (!type) return { type: null, fields: GENERIC_QUERY_FIELDS };
  return { type, fields: [] };
}

function filterItems(items: QuerySuggestItem[], filter: string): QuerySuggestItem[] {
  const f = filter.trim().toLowerCase();
  if (!f || f === "*") return items;
  return items.filter((it) => it.value.toLowerCase().startsWith(f) || it.value.toLowerCase().includes(f));
}

function isExactSource(name: string): boolean {
  const n = name.toLowerCase();
  return FROM_SOURCES.some((s) => s.value.toLowerCase() === n) || resolveQueryConfigType(n) != null;
}

function isExactField(name: string, fields: readonly string[]): boolean {
  const n = name.toLowerCase();
  return fields.some((s) => s.toLowerCase() === n);
}

/**
 * Next suggestions for the current query — keeps offering steps as the user clicks.
 */
export function getQuerySuggestState(
  query: string,
  opts?: QuerySuggestOptions,
): QuerySuggestState | null {
  const raw = query;
  const trimmedEnd = raw.replace(/\s+/g, " ").trimEnd();
  const lower = trimmedEnd.toLowerCase();
  const fromType = extractQueryFromType(trimmedEnd);
  const { type: resolvedFrom, fields: sourceFields } = resolveFieldsForSource(fromType, opts?.sourceFields);
  const fieldDetail = resolvedFrom ? `${resolvedFrom} field` : "record property";

  // Empty / whitespace → start keywords
  if (!trimmedEnd) {
    return {
      kind: "start",
      header: "Start a record query",
      filter: "",
      items: START_KEYWORDS,
    };
  }

  // Partial start keyword only (e.g. "F", "SE", "FROM" incomplete path)
  if (!/\bSELECT\b/i.test(trimmedEnd) && !/\bFROM\b/i.test(trimmedEnd)) {
    const items = filterItems(START_KEYWORDS, trimmedEnd);
    if (items.length === 0) return null;
    return {
      kind: "start",
      header: "Start a record query",
      filter: trimmedEnd,
      items,
    };
  }

  // WHERE clause — suggest filter fields for the FROM source
  const whereIdx = lower.lastIndexOf("where");
  if (whereIdx >= 0) {
    const afterWhere = trimmedEnd.slice(whereIdx + 5).trimStart();
    // Suggest field at start of WHERE or after AND
    if (!afterWhere || /(?:^|AND\s+)([\w]*)$/i.test(afterWhere)) {
      const m = afterWhere.match(/(?:^|AND\s+)([\w]*)$/i);
      const filter = (m?.[1] ?? "").trim();
      if (filter && isExactField(filter, sourceFields)) {
        // field chosen — wait for operator/value
        return null;
      }
      const pool = fieldItems(sourceFields, fieldDetail);
      const items = filterItems(pool, filter);
      if (items.length === 0 && resolvedFrom && sourceFields.length === 0) {
        return {
          kind: "where",
          header: `WHERE · loading ${resolvedFrom} fields…`,
          filter,
          items: [],
        };
      }
      return {
        kind: "where",
        header: resolvedFrom
          ? `WHERE · ${resolvedFrom} fields`
          : "WHERE · choose a filter field",
        filter,
        items,
      };
    }
    return null;
  }

  // FROM … (no WHERE yet)
  if (/\bFROM\b/i.test(trimmedEnd)) {
    const afterFromIdx = lower.lastIndexOf("from");
    const afterFrom = trimmedEnd.slice(afterFromIdx + 4).trimStart();
    const sourceToken = (afterFrom.split(/\s+/)[0] ?? "").trim();

    if (!sourceToken || (!isExactSource(sourceToken) && /^[\w]*$/.test(sourceToken))) {
      const filter = sourceToken;
      const items = filterItems(FROM_SOURCES, filter);
      return {
        kind: "from",
        header: "FROM · choose a record source",
        filter,
        items,
      };
    }

    // Source chosen → offer WHERE (fields unlock once /props dumpFields loads)
    if (isExactSource(sourceToken) && !/\bWHERE\b/i.test(afterFrom)) {
      const typeLabel = resolveQueryConfigType(sourceToken) ?? sourceToken;
      const n = sourceFields.length;
      return {
        kind: "where",
        header:
          n > 0
            ? `Continue · ${typeLabel} (${n} fields)`
            : `Continue · ${typeLabel} (loading fields…)`,
        filter: "",
        items: [WHERE_KEYWORD],
      };
    }
    return null;
  }

  // SELECT … (no FROM yet, or SELECT … FROM source)
  if (/^\s*SELECT\b/i.test(trimmedEnd)) {
    const after = trimmedEnd.replace(/^\s*SELECT\s*/i, "");
    // If FROM already present later in the string, prefer that source's fields
    const selectFields = sourceFields;
    const segments = after
      .replace(/\bFROM\b.*/i, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const beforeFrom = after.replace(/\bFROM\b.*/i, "");
    const lastRaw = (beforeFrom.split(",").pop() ?? "").trim();
    const endsWithComma = /,\s*$/.test(beforeFrom) || (!/\bFROM\b/i.test(after) && query.trimEnd().endsWith(","));
    const filter = endsWithComma || !lastRaw ? "" : lastRaw === "*" ? "" : lastRaw;

    if (/\bFROM\b/i.test(after)) {
      // Already has FROM — don't keep suggesting SELECT columns mid-FROM
      return null;
    }

    // Exact last field + no trailing comma → offer more fields + FROM
    if (!endsWithComma && lastRaw && isExactField(lastRaw, selectFields)) {
      const used = new Set(segments.map((s) => s.toLowerCase()));
      const remaining = fieldItems(selectFields, fieldDetail).filter(
        (f) => !used.has(f.value.toLowerCase()),
      );
      return {
        kind: "select",
        header: resolvedFrom
          ? `SELECT · ${resolvedFrom} columns`
          : "SELECT · add another column or continue",
        filter: "",
        items: [...remaining, FROM_KEYWORD],
      };
    }

    const used = new Set(segments.slice(0, -1).map((s) => s.toLowerCase()));
    const fieldPool = fieldItems(selectFields, fieldDetail).filter(
      (f) => !used.has(f.value.toLowerCase()),
    );
    const items = filterItems(fieldPool, filter);
    const withFrom =
      !filter || "from".startsWith(filter.toLowerCase()) ? [...items, FROM_KEYWORD] : items;
    return {
      kind: "select",
      header: resolvedFrom ? `SELECT · ${resolvedFrom} columns` : "SELECT · choose a result column",
      filter,
      items: filter ? filterItems(withFrom, filter) : withFrom,
    };
  }

  return null;
}

/** Apply a suggestion into the current query string. */
export function applyQuerySuggestion(query: string, item: QuerySuggestItem, kind: QuerySuggestKind): string {
  if (item.badge === "KEYWORD") {
    const key = item.value.toUpperCase();
    if (key === "SELECT") return "SELECT ";
    if (key === "FROM") {
      if (/^\s*SELECT\b/i.test(query) && !/\bFROM\b/i.test(query)) {
        return `${query.trimEnd()} FROM `;
      }
      if (!query.trim()) return "FROM ";
      if (/\bFROM\b/i.test(query)) return query.replace(/\bFROM\s*[\w]*$/i, "FROM ");
      return `${query.trimEnd()} FROM `;
    }
    if (key === "WHERE") {
      if (/\bWHERE\b/i.test(query)) return query;
      return `${query.trimEnd()} WHERE `;
    }
  }

  if (kind === "from" || item.badge === "SOURCE") {
    if (/\bFROM\b/i.test(query)) {
      return query.replace(/\bFROM\s*[\w]*$/i, `FROM ${item.value} `);
    }
    return `FROM ${item.value} `;
  }

  if (kind === "where") {
    if (/\bWHERE\s*$/i.test(query.trimEnd()) || /\bAND\s*$/i.test(query.trimEnd())) {
      return `${query.trimEnd()} ${item.value} `;
    }
    const m = query.match(/^(.*(?:WHERE|AND)\s+)([\w]*)$/i);
    if (m) return `${m[1]}${item.value} `;
    return `${query.trimEnd()} ${item.value} `;
  }

  // select field
  if (!/^\s*SELECT\b/i.test(query)) {
    return `SELECT ${item.value}`;
  }
  const m = query.match(/^(\s*SELECT\s*)(.*)$/i);
  if (!m) return `SELECT ${item.value}`;
  const prefix = m[1]!;
  const rest = m[2] ?? "";
  if (!rest.trim() || /,\s*$/.test(rest)) {
    const base = rest.replace(/,\s*$/, "").trim();
    return base ? `${prefix.trimEnd()} ${base}, ${item.value}` : `${prefix}${item.value}`;
  }
  const parts = rest.split(",");
  parts[parts.length - 1] = ` ${item.value}`;
  const cols = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");
  return `${prefix.trimEnd()} ${cols}`;
}

export const QUERY_PLACEHOLDER = "Text, /regex/i, or FROM inv WHERE size > 10";

export const QUERY_TRY_EXAMPLES = [
  "FROM inv WHERE size > 10",
  "FROM obj WHERE tradeable = no",
  'SELECT name, id FROM obj WHERE name CONTAINS "dragon"',
  "SELECT _header, name FROM npc WHERE name CONTAINS dragon",
] as const;

export const TEXT_TRY_EXAMPLES = ["Rune sword", "dragon longsword", "Trade"] as const;

export const REGEX_TRY_EXAMPLES = ["/^op[1-5]=Trade$/i", "dragon.*sword", "rune\\s+"] as const;
