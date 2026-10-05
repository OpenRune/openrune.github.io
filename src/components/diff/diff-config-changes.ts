import {
  diffChangesPageToContentBody,
  fetchDiffChangesPage,
  type DiffChangeCounts,
  type DiffChangeKind,
} from "@/lib/diff-changes";
import type { CacheTarget } from "@/lib/cache-api-client";

import { configLinesFromDiffBody } from "./diff-config-content";
import type { ConfigLine } from "./diff-types";

/** Rows per request. Large enough to amortise round trips, small enough to keep each one cheap. */
const PAGE_SIZE = 500;
/** The first request is smaller so the first screen paints almost immediately. */
const FIRST_PAGE_SIZE = 100;
/** Minimum gap between batches, so a long stream does not re-render on every page. */
const FLUSH_INTERVAL_MS = 120;

/** Kinds in the order the text view presents them, matching the whole-diff `/content` response. */
const KIND_ORDER: DiffChangeKind[] = ["added", "changed", "removed"];

export type DiffChangeProgress = {
  counts: DiffChangeCounts;
  /** Entities covered so far across all kinds. */
  loaded: number;
  /** Entities in the whole diff, known from the first response. */
  total: number;
  done: boolean;
};

export type StreamConfigDiffOptions = {
  cacheType: CacheTarget;
  configType: string;
  base: number;
  rev: number;
  headerLabelForId?: (id: number) => string | undefined;
  signal?: AbortSignal;
  /** Called with each batch of new lines, in render order. Never called after abort. */
  onBatch: (lines: ConfigLine[], progress: DiffChangeProgress) => void;
};

/**
 * Walks a config diff a page at a time, turning each page into rendered lines.
 *
 * Kinds are fetched in presentation order (added, then changed, then removed) and ids ascend within
 * a kind, so the concatenated result is identical to the single whole-diff response — but the first
 * batch arrives after one small request instead of after the entire diff has been built and sent.
 */
export async function streamConfigDiffLines(options: StreamConfigDiffOptions): Promise<void> {
  const { cacheType, configType, base, rev, headerLabelForId, signal, onBatch } = options;

  let counts: DiffChangeCounts = { added: 0, changed: 0, removed: 0 };
  let total = 0;
  let loaded = 0;
  let first = true;

  let pending: ConfigLine[] = [];
  let lastFlush = 0;

  const aborted = () => signal?.aborted === true;
  const flush = (done: boolean) => {
    if (aborted()) return;
    if (pending.length === 0 && !done) return;
    const batch = pending;
    pending = [];
    lastFlush = Date.now();
    onBatch(batch, { counts, loaded, total, done });
  };

  for (const kind of KIND_ORDER) {
    if (aborted()) break;
    // Counts arrive with the first response, so later kinds known to be empty cost no request.
    if (!first && counts[kind] === 0) continue;

    let after: number | undefined;
    for (;;) {
      const page = await fetchDiffChangesPage(
        cacheType,
        configType,
        { base, rev, kind, limit: first ? FIRST_PAGE_SIZE : PAGE_SIZE, after },
        signal,
      );
      if (aborted()) return;

      counts = page.counts;
      total = page.total;
      if (page.rows.length > 0) {
        loaded += page.rows.length;
        const body = diffChangesPageToContentBody(page, page.rows);
        pending.push(...configLinesFromDiffBody(body, { headerLabelForId }));
      }

      // Always show the first page right away; after that, batch to avoid re-rendering per page.
      if (first || Date.now() - lastFlush >= FLUSH_INTERVAL_MS) flush(false);
      first = false;

      if (!page.hasMore || page.nextCursor == null) break;
      after = page.nextCursor;
    }
  }

  flush(true);
}
