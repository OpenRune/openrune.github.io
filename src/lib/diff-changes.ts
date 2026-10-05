import { diffConfigChangesUrl, type CacheTarget } from "@/lib/cache-api-client";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";

export type DiffChangeKind = "added" | "changed" | "removed";

export type DiffChangeRow = {
  id: number;
  kind: DiffChangeKind;
  changedInRev: number;
  name?: string;
  gameval?: string;
  /** Full payload for `added`; `{field: {from, to}}` for `changed`; absent for `removed`. */
  fields?: Record<string, unknown>;
};

export type DiffChangeCounts = { added: number; changed: number; removed: number };

export type DiffChangesPage = {
  base: number;
  rev: number;
  type: string;
  counts: DiffChangeCounts;
  total: number;
  rows: DiffChangeRow[];
  nextCursor?: number;
  hasMore: boolean;
};

export type DiffChangesRequest = {
  base: number;
  rev: number;
  kind?: DiffChangeKind;
  limit: number;
  after?: number;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseRow(raw: unknown): DiffChangeRow | null {
  const o = asRecord(raw);
  if (!o) return null;
  const id = typeof o.id === "number" ? o.id : Number(o.id);
  if (!Number.isFinite(id)) return null;
  const kind = o.kind === "added" || o.kind === "changed" || o.kind === "removed" ? o.kind : null;
  if (!kind) return null;
  return {
    id: Math.trunc(id),
    kind,
    changedInRev: asCount(o.changedInRev),
    name: typeof o.name === "string" ? o.name : undefined,
    gameval: typeof o.gameval === "string" ? o.gameval : undefined,
    fields: asRecord(o.fields),
  };
}

export function parseDiffChangesPage(raw: unknown): DiffChangesPage | null {
  const o = asRecord(raw);
  if (!o || !Array.isArray(o.rows)) return null;
  const rawCounts = asRecord(o.counts);
  const counts: DiffChangeCounts = {
    added: asCount(rawCounts?.added),
    changed: asCount(rawCounts?.changed),
    removed: asCount(rawCounts?.removed),
  };
  return {
    base: asCount(o.base),
    rev: asCount(o.rev),
    type: typeof o.type === "string" ? o.type : "config",
    counts,
    total:
      typeof o.total === "number" ? o.total : counts.added + counts.changed + counts.removed,
    rows: o.rows.map(parseRow).filter((r): r is DiffChangeRow => r !== null),
    nextCursor: typeof o.nextCursor === "number" ? o.nextCursor : undefined,
    hasMore: o.hasMore === true,
  };
}

export async function fetchDiffChangesPage(
  cacheType: CacheTarget,
  configType: string,
  params: DiffChangesRequest,
  signal?: AbortSignal,
): Promise<DiffChangesPage> {
  const url = diffConfigChangesUrl(cacheType, configType, params);
  // Published revisions are immutable, so each page keeps its own permanent IndexedDB entry.
  const cacheKey = [
    "diff:changes",
    `${cacheType.ip}:${cacheType.port}`,
    configType,
    params.base,
    params.rev,
    params.kind ?? "all",
    params.after ?? 0,
    params.limit,
  ].join(":");
  const { data } = await conditionalJsonFetch<unknown>(cacheKey, url, { signal });
  const page = parseDiffChangesPage(data);
  if (!page) throw new Error("Unexpected response from the diff changes endpoint");
  return page;
}

/**
 * Reshapes a page into the `{added, changed, removed, gamevals}` body that
 * `configLinesFromDiffBody` already turns into rendered lines, so paging reuses the existing field
 * expansion (params, enum values, transforms, sub-ops, countobj, option arrays) untouched.
 */
export function diffChangesPageToContentBody(page: DiffChangesPage, rows: DiffChangeRow[]): unknown {
  const added: Record<string, unknown> = {};
  const changed: Record<string, unknown> = {};
  const removed: number[] = [];
  const gamevals: Record<string, string> = {};

  for (const row of rows) {
    if (row.gameval) gamevals[String(row.id)] = row.gameval;
    if (row.kind === "added") added[String(row.id)] = row.fields ?? {};
    else if (row.kind === "changed") changed[String(row.id)] = row.fields ?? {};
    else removed.push(row.id);
  }

  return { base: page.base, rev: page.rev, type: page.type, added, changed, removed, gamevals };
}
