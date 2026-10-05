import { cacheServerUrl, type CacheTarget } from "@/lib/cache-api-client";

const TOKEN_STORAGE_KEY = "openrune-admin-token";

export function readAdminToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
}

export function writeAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export type AdminRevision = {
  rev: number;
  status: string;
  stage: string | null;
  published: boolean;
  publishedAt: string | null;
  hasData: boolean;
  attempts: number;
  error: string | null;
  sourceCacheId: number | null;
  latestSourceCacheId?: number | null;
  sourceTimestamp: string | null;
  metrics: Record<string, unknown> | null;
  updatedAt: string | null;
};

export type AdminOverview = {
  game: { id: number; slug: string; name: string; environment: string };
  latestPublished: number | null;
  latestDiscovered: number | null;
  published: number;
  byStatus: Record<string, number>;
  ingestion: { rev: number; stage: string; percent: number; message: string; at: number } | null;
  /** Operator-started import of older revisions, worked newest first. Null when none is running. */
  backfill: {
    pending: number[];
    done: number[];
    failed: number[];
    total: number;
    /** A newly released revision being imported ahead of the queue. */
    pausedFor: number | null;
    startedAt: string;
    updatedAt: string;
  } | null;
  workerPaused: boolean;
  uptimeMs: number;
  types: Array<{ id: number; key: string; kind: string }>;
};

export type AdminRun = {
  id: number;
  rev: number;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  stage: string | null;
  error: string | null;
  metrics: Record<string, unknown> | null;
};

export type AdminMetrics = {
  counters: Record<string, number>;
  timers: Record<string, { count: number; avgMs: number; maxMs: number; lastMs: number; totalMs: number }>;
  slow: Array<{ name: string; detail: string; ms: number; at: number }>;
};

export type AdminDb = {
  tables: Array<{ table: string; bytes: number; estimatedRows: number }>;
  entitiesAtLatest: Record<string, number>;
  pools: Record<string, { active?: number; idle?: number; total?: number; waiting?: number }>;
};

export type AdminMemory = {
  heapUsedMb: number;
  heapCommittedMb: number;
  heapMaxMb: number;
  heapPeakMb: number;
  threads: number;
};

export type AdminCache = {
  entries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
};

export async function adminFetch<T>(
  target: CacheTarget,
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set("X-Admin-Token", token);
  const res = await fetch(cacheServerUrl(target, `/admin${path}`), { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep status message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}
