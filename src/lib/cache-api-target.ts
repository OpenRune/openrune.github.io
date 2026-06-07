export type CacheTarget = {
  ip: string;
  port: number;
};

export function isLocalCacheHost(host: string): boolean {
  const trimmed = host.trim().toLowerCase();
  return trimmed === "localhost" || trimmed === "127.0.0.1";
}

const UPSTREAM_ENV: Record<string, string> = {
  "osrs.openrune.dev": "OSRS_CACHE_UPSTREAM",
  "rs3.openrune.dev": "RS3_CACHE_UPSTREAM",
};

function upstreamFromEnv(host: string): string | null {
  const envKey = UPSTREAM_ENV[host.trim().toLowerCase()];
  const value = envKey ? process.env[envKey]?.trim() : undefined;
  return value ? value.replace(/\/$/, "") : null;
}

/** Base URL for a cache server (browser direct calls + server-side table-all aggregation). */
export function cacheServerOrigin(cacheType: CacheTarget): string {
  const host = cacheType.ip.trim();
  if (isLocalCacheHost(host)) {
    return `http://${host}:${cacheType.port}`;
  }

  const fromEnv = upstreamFromEnv(host);
  if (fromEnv) return fromEnv;

  // 8090 in cache-types is the local-dev label; production OSRS is served on 443.
  if (cacheType.port === 8090) {
    return `https://${host}`;
  }
  return `https://${host}:${cacheType.port}`;
}
