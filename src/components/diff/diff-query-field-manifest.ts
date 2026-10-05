/**
 * Query source aliases + live `dumpFields` from `GET /diff/config/{type}/props`.
 * Field catalogs are server-owned (ConfigSerializer.dumpFieldNames) — no static per-type lists.
 */

/** Query aliases → cache config type id (props / table path segment). */
export function resolveQueryConfigType(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "obj" || s === "object" || s === "objects" || s === "item" || s === "items") return "items";
  if (s === "npc" || s === "npcs") return "npcs";
  if (s === "loc" || s === "locs" || s === "location" || s === "locations") return "objects";
  if (s === "if" || s === "interface" || s === "interfaces") return "interfaces";
  if (s === "inv" || s === "inventory" || s === "inventories") return "inv";
  if (s === "seq" || s === "sequence" || s === "sequences") return "sequences";
  if (s === "spotanim" || s === "spotanims") return "spotanims";
  if (s === "param" || s === "params") return "params";
  if (s === "overlay" || s === "overlays") return "overlay";
  if (s === "underlay" || s === "underlays") return "underlay";
  if (s === "texture" || s === "textures") return "textures";
  if (s === "varc" || s === "varcs" || s === "varclient") return "varclient";
  return s;
}

/** Extract `FROM <source>` type from a query string. */
export function extractQueryFromType(query: string): string | null {
  const m = query.match(/\bFROM\s+(\w+)/i);
  return resolveQueryConfigType(m?.[1] ?? null);
}

/** Used only before a FROM source is known (SELECT with no FROM yet). */
export const GENERIC_QUERY_FIELDS = [
  "_header",
  "name",
  "id",
  "gameval",
  "text",
] as const;

export function parseDumpFieldsPayload(data: unknown): string[] | null {
  if (!data || typeof data !== "object") return null;
  const raw = (data as { dumpFields?: unknown }).dumpFields;
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const name = v.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out.length > 0 ? out : null;
}

/** In-memory cache of `/props` dumpFields by cache+type. */
const dumpFieldsCache = new Map<string, string[]>();

export function dumpFieldsCacheKey(cacheTypeId: string, configType: string): string {
  return `${cacheTypeId}:${configType}`;
}

export function getCachedDumpFields(cacheTypeId: string, configType: string): string[] | null {
  return dumpFieldsCache.get(dumpFieldsCacheKey(cacheTypeId, configType)) ?? null;
}

export function setCachedDumpFields(cacheTypeId: string, configType: string, fields: string[]): void {
  dumpFieldsCache.set(dumpFieldsCacheKey(cacheTypeId, configType), fields);
}
