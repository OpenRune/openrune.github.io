import type { CacheType } from "@/lib/cache-types";
import { cacheServerUrl } from "@/lib/cache-api-client";

export type ZipArchiveKind = "sprites" | "textures";

/** Server `ZipType` enum is uppercase; query accepts either. */
export function zipCreateUrl(
  cacheType: Pick<CacheType, "ip" | "port">,
  params: {
    type: ZipArchiveKind;
    base: number;
    rev: number;
  },
): string {
  const search = new URLSearchParams({
    type: params.type,
    base: String(params.base),
    rev: String(params.rev),
  });
  return cacheServerUrl(cacheType, `/zip/create?${search.toString()}`);
}

export function zipProgressUrl(cacheType: Pick<CacheType, "ip" | "port">, jobId: string): string {
  return cacheServerUrl(cacheType, `/zip/progress/${encodeURIComponent(jobId)}`);
}

export function zipDownloadUrl(cacheType: Pick<CacheType, "ip" | "port">, serverDownloadPath: string): string {
  const trimmed = serverDownloadPath.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return cacheServerUrl(cacheType, trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
}

export function zipCancelUrl(cacheType: Pick<CacheType, "ip" | "port">, jobId: string): string {
  return cacheServerUrl(cacheType, `/zip/${encodeURIComponent(jobId)}`);
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

export function triggerZipDownload(
  cacheType: Pick<CacheType, "ip" | "port">,
  serverDownloadPath: string,
  filename: string,
): void {
  const url = zipDownloadUrl(cacheType, serverDownloadPath);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
