export type CacheTarget = {
  ip: string;
  port: number;
};

export function isLocalCacheHost(host: string): boolean {
  const trimmed = host.trim().toLowerCase();
  return trimmed === "localhost" || trimmed === "127.0.0.1";
}

/** Local dev uses `http://host:port`; production hosts use `https://host` (no port). */
export function cacheServerOrigin(cacheType: CacheTarget): string {
  const host = cacheType.ip.trim();
  if (isLocalCacheHost(host)) {
    return `http://${host}:${cacheType.port}`;
  }
  return `https://${host}`;
}

function parseCacheTargetJson(raw: string | null | undefined): CacheTarget | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CacheTarget>;
    const ip = typeof parsed.ip === "string" ? parsed.ip.trim() : "";
    const port = Number(parsed.port);
    if (!ip || !Number.isFinite(port) || port < 1 || port > 65535) return null;
    return { ip, port };
  } catch {
    return null;
  }
}

export function parseCacheTarget(
  searchParams: URLSearchParams,
  headerValue?: string | null,
  cookieValue?: string | null,
): CacheTarget | null {
  const host = searchParams.get("_host")?.trim();
  const portRaw = searchParams.get("_port");
  if (host && portRaw) {
    const port = Number(portRaw);
    if (Number.isFinite(port) && port >= 1 && port <= 65535) {
      return { ip: host, port };
    }
  }

  return parseCacheTargetJson(headerValue) ?? parseCacheTargetJson(cookieValue);
}

/** Strip routing params before forwarding to the upstream cache server. */
export function stripCacheRoutingParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.delete("_host");
  next.delete("_port");
  return next;
}
