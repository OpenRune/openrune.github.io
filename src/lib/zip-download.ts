import type { CacheType } from "@/lib/cache-types";
import { syncCacheTypeCookie } from "@/lib/cache-proxy-client";

export type ZipArchiveKind = "sprites" | "textures";

/** Server `ZipType` enum is uppercase; query accepts either. */
export function zipCreateUrl(params: {
  type: ZipArchiveKind;
  base: number;
  rev: number;
}): string {
  const search = new URLSearchParams({
    type: params.type,
    base: String(params.base),
    rev: String(params.rev),
  });
  return `/api/cache-proxy/zip/create?${search.toString()}`;
}

export function zipProgressUrl(jobId: string): string {
  return `/api/cache-proxy/zip/progress/${encodeURIComponent(jobId)}`;
}

/** Map server-relative `/zip/download/...` to the Next cache-proxy URL. */
export function zipDownloadProxyUrl(serverDownloadPath: string): string {
  const trimmed = serverDownloadPath.trim();
  if (trimmed.startsWith("/api/cache-proxy/")) return trimmed;
  if (trimmed.startsWith("/")) return `/api/cache-proxy${trimmed}`;
  return `/api/cache-proxy/${trimmed}`;
}

export function zipCancelUrl(jobId: string): string {
  return `/api/cache-proxy/zip/${encodeURIComponent(jobId)}`;
}

export type ZipCreateResponse =
  | {
      jobId: string;
      type: string;
      status: "ready";
      downloadUrl: string;
      progress: number;
      message?: string;
    }
  | {
      jobId: string;
      type: string;
      status: "created";
      progressUrl?: string;
      sseUrl?: string;
    };

export type ZipProgressPollResponse = {
  jobId: string;
  progress: number;
  message: string;
  downloadUrl: string | null;
};

export function parseZipCreateResponse(data: unknown): ZipCreateResponse | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const jobId = typeof o.jobId === "string" ? o.jobId : null;
  const type = typeof o.type === "string" ? o.type : "";
  const status = typeof o.status === "string" ? o.status : "";
  if (!jobId) return null;

  if (status === "ready") {
    const downloadUrl = typeof o.downloadUrl === "string" ? o.downloadUrl : null;
    const progress = typeof o.progress === "number" ? o.progress : 100;
    if (!downloadUrl) return null;
    return { jobId, type, status: "ready", downloadUrl, progress, message: typeof o.message === "string" ? o.message : undefined };
  }

  if (status === "created") {
    return {
      jobId,
      type,
      status: "created",
      progressUrl: typeof o.progressUrl === "string" ? o.progressUrl : undefined,
      sseUrl: typeof o.sseUrl === "string" ? o.sseUrl : undefined,
    };
  }

  return null;
}

export function defaultZipFilename(jobId: string): string {
  return `${jobId}.zip`;
}

/** Trigger a file download via the cache proxy (relies on `cache-type` cookie). */
export function triggerZipDownload(cacheType: Pick<CacheType, "ip" | "port">, serverDownloadPath: string, filename: string): void {
  syncCacheTypeCookie(cacheType);
  const url = zipDownloadProxyUrl(serverDownloadPath);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
