import { cacheServerOrigin, type CacheTarget } from "@/lib/cache-api-target";

export type { CacheTarget };

export { cacheServerOrigin };

/** Direct cache-server URL (e.g. https://osrs.openrune.dev/cache/nav). */
export function cacheServerUrl(cacheType: CacheTarget, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${cacheServerOrigin(cacheType)}${normalized}`;
}

/** True for direct cache-server fetch/EventSource URLs (used by app-shell offline gate). */
export function isCacheServerRequestUrl(url: string): boolean {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (parsed.pathname === "/status" || parsed.pathname.endsWith("/status")) return true;

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      const port = Number(parsed.port);
      return Number.isFinite(port) && port >= 8090 && port <= 8099;
    }

    if (parsed.hostname.endsWith(".openrune.dev")) return true;
    return false;
  } catch {
    return false;
  }
}

export function diffRevisionsUrl(cacheType: CacheTarget) {
  return cacheServerUrl(cacheType, "/diff/revisions");
}

export function diffSupportManifestUrl(cacheType: CacheTarget, rev: number) {
  return cacheServerUrl(cacheType, `/diff/support/manifest?rev=${rev}`);
}

/**
 * Normalize cache-server diff revisions JSON to sorted unique numeric revisions.
 * Accepts a raw number array, common object shapes, or `revisionOptions` string lists.
 */
export function parseDiffRevisionsResponse(data: unknown): number[] {
  const collectNumbers = (arr: unknown[]): number[] => {
    const out: number[] = [];
    for (const x of arr) {
      if (typeof x === "number" && Number.isFinite(x)) {
        out.push(Math.trunc(x));
        continue;
      }
      if (typeof x === "string") {
        const n = Number.parseInt(x, 10);
        if (Number.isFinite(n)) out.push(n);
      }
    }
    return out;
  };

  const dedupeSort = (nums: number[]) => [...new Set(nums)].sort((a, b) => a - b);

  if (Array.isArray(data)) {
    return dedupeSort(collectNumbers(data));
  }

  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["revisions", "revisionIds", "ids"] as const) {
      const raw = o[key];
      if (Array.isArray(raw)) return dedupeSort(collectNumbers(raw));
    }
    const revisionOptions = o.revisionOptions;
    if (Array.isArray(revisionOptions)) {
      const fromStrings = revisionOptions
        .filter((x): x is string => typeof x === "string")
        .map((s) => {
          const m = /\d+/.exec(s);
          return m ? Number.parseInt(m[0], 10) : NaN;
        })
        .filter((n) => Number.isFinite(n));
      if (fromStrings.length > 0) return dedupeSort(fromStrings);
    }
  }

  return [];
}

export function cacheDataUrl(cacheType: CacheTarget, search: URLSearchParams): string {
  return cacheServerUrl(cacheType, `/cache?${search.toString()}`);
}

export function gamevalUrl(cacheType: CacheTarget, type: string, search: URLSearchParams): string {
  return cacheServerUrl(cacheType, `/gameval/${type}?${search.toString()}`);
}

export function spritesCdnGameSlug(cacheType: CacheTarget): string {
  const host = cacheType.ip.trim().toLowerCase();
  if (host.includes("rs3")) return "rs3";
  return "osrs";
}

/** Public sprite CDN origin (Cloudflare R2 custom domain). */
export const SPRITES_CDN_BASE = "https://cdn.openrune.dev";

export function spritesCdnBase(_cacheType?: CacheTarget): string {
  return SPRITES_CDN_BASE;
}

/** @deprecated Use {@link spritesCdnBase}. */
export function spritesCdnBaseFromEnv(cacheType: CacheTarget): string {
  return spritesCdnBase(cacheType);
}

export function spritesCdnObjectUrl(params: {
  cdnBase: string;
  game: string;
  rev: number;
  id: string | number;
}): string {
  const base = params.cdnBase.replace(/\/$/, "");
  return `${base}/${params.game}/rev/${params.rev}/sprites/${params.id}.png`;
}

export function spritesProxyUrl(
  cacheType: CacheTarget,
  params: {
    id: string | number;
    width?: number;
    height?: number;
    keepAspectRatio?: boolean;
    base?: number;
    rev?: number;
    source?: number;
    indexed?: number;
    /** When set, prefer CDN for full-size sprites. */
    cdnBase?: string | null;
    cdnGame?: string | null;
  },
) {
  const needsResize =
    params.width != null || params.height != null || params.indexed != null;
  const cdnBase = (params.cdnBase ?? spritesCdnBase(cacheType)).replace(/\/$/, "");
  const cdnGame = params.cdnGame ?? spritesCdnGameSlug(cacheType);
  const spriteRev = params.source ?? params.rev;
  if (!needsResize && spriteRev != null) {
    return spritesCdnObjectUrl({
      cdnBase,
      game: cdnGame,
      rev: spriteRev,
      id: params.id,
    });
  }

  const search = new URLSearchParams({ id: String(params.id) });
  if (params.width != null) search.set("width", String(params.width));
  if (params.height != null) search.set("height", String(params.height));
  if (params.keepAspectRatio != null) search.set("keepAspectRatio", String(params.keepAspectRatio));
  if (params.base != null) search.set("base", String(params.base));
  if (params.rev != null) search.set("rev", String(params.rev));
  if (params.source != null) search.set("source", String(params.source));
  if (params.indexed != null) search.set("indexed", String(params.indexed));
  return cacheServerUrl(cacheType, `/sprites?${search.toString()}`);
}

export function combinedSpritesUrl(cacheType: CacheTarget, rev: number, base = 1) {
  return cacheServerUrl(cacheType, `/diff/combined/sprites?base=${base}&rev=${rev}`);
}

export function cacheTexturesSnapshotUrl(cacheType: CacheTarget, rev: number): string {
  return cacheDataUrl(
    cacheType,
    new URLSearchParams({ type: "textures", rev: String(rev) }),
  );
}

export function texturesProxyUrl(
  cacheType: CacheTarget,
  params: {
    id: string | number;
    width?: number;
    height?: number;
    keepAspectRatio?: boolean;
    base?: number;
    rev?: number;
  },
) {
  const search = new URLSearchParams({ id: String(params.id) });
  if (params.width != null) search.set("width", String(params.width));
  if (params.height != null) search.set("height", String(params.height));
  if (params.keepAspectRatio != null) search.set("keepAspectRatio", String(params.keepAspectRatio));
  if (params.base != null) search.set("base", String(params.base));
  if (params.rev != null) search.set("rev", String(params.rev));
  return cacheServerUrl(cacheType, `/textures?${search.toString()}`);
}

/**
 * Diff cache routes expect `base` ≤ `rev` (older build → newer). The workbench may show Base as the
 * latest build and Compare as an older build — normalize before calling diff endpoints.
 */
export function diffCacheOrderedPair(uiBase: number, uiCompare: number): { base: number; rev: number } {
  const lo = Math.min(uiBase, uiCompare);
  const hi = Math.max(uiBase, uiCompare);
  return { base: lo, rev: hi };
}

export function diffSpriteResolveUrl(
  cacheType: CacheTarget,
  spriteId: number,
  params: { base: number; rev: number; source?: number; width?: number; height?: number },
) {
  const needsResize = params.width != null || params.height != null;
  const cdnBase = spritesCdnBase(cacheType);
  const spriteRev = params.source ?? params.rev;
  if (!needsResize) {
    return spritesCdnObjectUrl({
      cdnBase,
      game: spritesCdnGameSlug(cacheType),
      rev: spriteRev,
      id: spriteId,
    });
  }
  const search = new URLSearchParams({
    base: String(params.base),
    rev: String(params.rev),
  });
  if (params.source != null) search.set("source", String(params.source));
  if (params.width != null) search.set("width", String(params.width));
  if (params.height != null) search.set("height", String(params.height));
  return cacheServerUrl(cacheType, `/diff/sprite/${spriteId}?${search.toString()}`);
}

function normalizeConfigTypeForApi(configType: string): string {
  const normalized = configType.trim().toLowerCase();
  if (normalized === "spotanim") return "spotanims";
  if (normalized === "param") return "params";
  return configType;
}

export function diffConfigTableUrl(
  cacheType: CacheTarget,
  configType: string,
  params: { base: number; rev: number; offset: number; limit: number; q?: string; mode?: string },
) {
  const search = new URLSearchParams({
    base: String(params.base),
    rev: String(params.rev),
    offset: String(params.offset),
    limit: String(params.limit),
  });
  if (params.q != null && params.q !== "") search.set("q", params.q);
  if (params.mode != null && params.mode !== "") {
    search.set("mode", params.mode);
    search.set("queryType", params.mode);
  }
  return cacheServerUrl(
    cacheType,
    `/diff/config/${encodeURIComponent(normalizeConfigTypeForApi(configType))}/table?${search.toString()}`,
  );
}

/** Aggregated table-all via Next.js route (paginates upstream `/table`). */
export function diffConfigTableAllUrl(
  cacheType: CacheTarget,
  configType: string,
  params: { base: number; rev: number },
) {
  const search = new URLSearchParams({
    base: String(params.base),
    rev: String(params.rev),
    ip: cacheType.ip,
    port: String(cacheType.port),
  });
  return `/api/diff/config/${encodeURIComponent(normalizeConfigTypeForApi(configType))}/table-all?${search.toString()}`;
}

export function diffConfigContentUrl(
  cacheType: CacheTarget,
  configType: string,
  params: { base: number; rev: number },
) {
  const search = new URLSearchParams({
    base: String(params.base),
    rev: String(params.rev),
  });
  return cacheServerUrl(
    cacheType,
    `/diff/config/${encodeURIComponent(normalizeConfigTypeForApi(configType))}/content?${search.toString()}`,
  );
}

export function diffConfigSchemaUrl(cacheType: CacheTarget, configType: string) {
  return cacheServerUrl(
    cacheType,
    `/diff/config/${encodeURIComponent(normalizeConfigTypeForApi(configType))}/props`,
  );
}

export function diffSpriteImageUrl(
  cacheType: CacheTarget,
  spriteId: number,
  params: { base: number; rev: number; source: number },
) {
  // Full-size compare/base thumbs always hit the public CDN (not /diff/sprite).
  return spritesCdnObjectUrl({
    cdnBase: spritesCdnBase(cacheType),
    game: spritesCdnGameSlug(cacheType),
    rev: params.source,
    id: spriteId,
  });
}

export function diffDeltaSpritesUrl(cacheType: CacheTarget, params: { base: number; rev: number }) {
  return cacheServerUrl(cacheType, `/diff/delta/sprites?base=${params.base}&rev=${params.rev}`);
}

export function diffDeltaSummaryUrl(cacheType: CacheTarget, params: { base: number; rev: number }) {
  return cacheServerUrl(cacheType, `/diff/delta/summary?base=${params.base}&rev=${params.rev}`);
}

export function diffDeltaSpritesSummaryUrl(cacheType: CacheTarget, params: { base: number; rev: number }) {
  return cacheServerUrl(
    cacheType,
    `/diff/delta/sprites/summary?base=${params.base}&rev=${params.rev}`,
  );
}
