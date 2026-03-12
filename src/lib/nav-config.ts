/** Represents one entry in the diff sidebar nav (archive or config section). */
export type NavSection = {
  /** Frontend section / URL key. */
  id: string;
  /** Display label shown in the sidebar. */
  label: string;
  /** Backend API type parameter (may differ from id, e.g. spotanim → spotanims). Defaults to id when absent. */
  apiType?: string;
  /** Minimum revision at which this section is active. */
  minRevision?: number;
};

export type NavConfig = {
  archives: NavSection[];
  configs: NavSection[];
};

export type GamevalGroup = {
  id: string;
  label: string;
  minRevision: number;
};

export function cacheNavUrl(): string {
  return "/api/cache-proxy/cache/nav";
}

export function cacheGamevalGroupsUrl(): string {
  return "/api/cache-proxy/cache/gameval/groups";
}

export function parseNavConfig(data: unknown): NavConfig | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const archives = parseNavSections(d.archives);
  const configs = parseNavSections(d.configs);
  if (!archives || !configs) return null;
  return { archives, configs };
}

function parseNavSections(raw: unknown): NavSection[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const s = item as Record<string, unknown>;
    const id = typeof s.id === "string" ? s.id : null;
    const label = typeof s.label === "string" ? s.label : null;
    if (!id || !label) return [];
    return [
      {
        id,
        label,
        apiType: typeof s.apiType === "string" ? s.apiType : undefined,
        minRevision: typeof s.minRevision === "number" ? s.minRevision : undefined,
      } satisfies NavSection,
    ];
  });
}

export function parseGamevalGroups(data: unknown): GamevalGroup[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.groups)) return [];
  return d.groups.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const g = item as Record<string, unknown>;
    const id = typeof g.id === "string" ? g.id : null;
    const label = typeof g.label === "string" ? g.label : null;
    const minRevision = typeof g.minRevision === "number" ? g.minRevision : 0;
    if (!id || !label) return [];
    return [{ id, label, minRevision } satisfies GamevalGroup];
  });
}
