import { cacheServerUrl, type CacheTarget } from "@/lib/cache-api-client";
import { conditionalJsonFetch, type ConditionalJsonResult } from "@/lib/openrune-idb-cache";

export type DiffDecodeRevisionStatus = {
  revision: number;
  status: string;
  progress: number;
  message: string;
  error?: string | null;
};

export type DiffDecodeProgress = {
  status: "decoding" | "ready" | "missing" | "error";
  progress: number;
  message: string;
  details?: string;
  revisions: DiffDecodeRevisionStatus[];
};

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  return data as Record<string, unknown>;
}

function asRevisionStatuses(raw: unknown): DiffDecodeRevisionStatus[] {
  if (!Array.isArray(raw)) return [];
  const out: DiffDecodeRevisionStatus[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const revision = typeof o.revision === "number" ? o.revision : Number(o.revision);
    if (!Number.isFinite(revision)) continue;
    out.push({
      revision: Math.trunc(revision),
      status: typeof o.status === "string" ? o.status : "decoding",
      progress: typeof o.progress === "number" ? Math.round(o.progress) : 0,
      message: typeof o.message === "string" ? o.message : "Decoding…",
      error: typeof o.error === "string" ? o.error : null,
    });
  }
  return out;
}

/** True when cache-server returned an on-demand decode / missing payload (HTTP 202 body or equivalent). */
export function isDiffDecodePayload(data: unknown): boolean {
  const o = asRecord(data);
  if (!o) return false;
  const status = o.status;
  return status === "decoding" || status === "missing";
}

export function parseDiffDecodeProgress(data: unknown): DiffDecodeProgress | null {
  const o = asRecord(data);
  if (!o) return null;
  const status = o.status;
  if (status !== "decoding" && status !== "ready" && status !== "missing" && status !== "error") {
    return null;
  }
  const revisions = asRevisionStatuses(o.revisions);
  const progress =
    typeof o.progress === "number"
      ? Math.round(o.progress)
      : revisions.length > 0
        ? Math.round(revisions.reduce((sum, r) => sum + r.progress, 0) / revisions.length)
        : 0;
  return {
    status,
    progress: Math.min(100, Math.max(0, progress)),
    message: typeof o.message === "string" ? o.message : "Decoding diff binaries…",
    details: typeof o.details === "string" ? o.details : undefined,
    revisions,
  };
}

export function diffDecodeStatusUrl(cacheType: CacheTarget, revisions: number[]): string {
  const unique = [...new Set(revisions.filter((r) => Number.isFinite(r) && r > 0))].sort((a, b) => a - b);
  return cacheServerUrl(cacheType, `/diff/decode/status?revs=${unique.join(",")}`);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Like [conditionalJsonFetch], but when the cache server returns a decode-in-progress payload,
 * polls `/diff/decode/status` and retries the original URL until ready (or missing/error/timeout).
 */
export async function conditionalJsonFetchAwaitingDecode<T = unknown>(
  cacheKey: string,
  url: string,
  opts: {
    cacheType: CacheTarget;
    onProgress?: (progress: DiffDecodeProgress) => void;
    signal?: AbortSignal;
    pollMs?: number;
    maxWaitMs?: number;
  },
): Promise<ConditionalJsonResult<T>> {
  const pollMs = opts.pollMs ?? 750;
  const maxWaitMs = opts.maxWaitMs ?? 10 * 60 * 1000;
  const startedAt = Date.now();
  let lastRevisions: number[] = [];

  while (true) {
    opts.signal?.throwIfAborted();
    const result = await conditionalJsonFetch<T>(cacheKey, url, { signal: opts.signal });
    const decode = parseDiffDecodeProgress(result.data);
    if (!decode || decode.status === "missing" || decode.status === "error") {
      return result;
    }
    if (decode.status !== "decoding") {
      return result;
    }

    opts.onProgress?.(decode);
    lastRevisions =
      decode.revisions.length > 0
        ? decode.revisions.map((r) => r.revision)
        : lastRevisions;

    if (Date.now() - startedAt > maxWaitMs) {
      throw new Error(decode.message || "Timed out waiting for diff decode");
    }

    if (lastRevisions.length > 0) {
      try {
        const statusUrl = diffDecodeStatusUrl(opts.cacheType, lastRevisions);
        const statusRes = await fetch(statusUrl, { cache: "no-store", signal: opts.signal });
        if (statusRes.ok) {
          const statusJson = (await statusRes.json()) as unknown;
          const statusProgress = parseDiffDecodeProgress(statusJson);
          if (statusProgress) {
            opts.onProgress?.(statusProgress);
            if (statusProgress.status === "ready") {
              // Fall through to retry the original content URL.
            } else if (statusProgress.status === "missing" || statusProgress.status === "error") {
              return {
                data: statusJson as T,
                fromIndexedDb: false,
              };
            }
          }
        }
      } catch (e) {
        if (opts.signal?.aborted) throw e;
        // Status poll failures are non-fatal; retry content URL below.
      }
    }

    await sleep(pollMs, opts.signal);
  }
}
