/** Represents one entry in the diff sidebar nav (archive or config section). */
export type NavSection = {
  /** Frontend section / URL key. */
  id: string;
  /** Display label shown in the sidebar. */
  label: string;
  /** Optional nav-specific display label from API (preferred over displayName/label when present). */
  navLabel?: string;
  /** Optional server-provided nav display name override (preferred when present). */
  displayName?: string;
  /** Backend API type parameter (may differ from id, e.g. spotanim → spotanims). Defaults to id when absent. */
  apiType?: string;
  /** Minimum revision at which this section is active. */
  minRevision?: number;
  /** Optional primary gameval type for this section (e.g. items, npcs, sequences). */
  gamevalType?: string;
  /** Optional backend enum name for gameval type (e.g. ITEMTYPES). */
  gamevalEnum?: string;
};

const GAMEVAL_ENUM_TO_TYPE: Record<string, string> = {
  ITEMTYPES: "items",
  NPCTYPES: "npcs",
  INVTYPES: "inv",
  VARPTYPES: "varp",
  VARBITTYPES: "varbits",
  VARCSTYPES: "varcs",
  OBJTYPES: "objects",
  SEQTYPES: "sequences",
  SPOTTYPES: "spotanims",
  ROWTYPES: "dbrows",
  TABLETYPES: "dbtables",
  SOUNDTYPES: "jingles",
  SPRITETYPES: "sprites",
  IFTYPES: "interfaces",
};

function normalizeGamevalType(gamevalType: string | undefined, gamevalEnum: string | undefined): string | undefined {
  if (typeof gamevalType === "string" && gamevalType.trim()) return gamevalType;
  if (typeof gamevalEnum === "string" && gamevalEnum.trim()) {
    return GAMEVAL_ENUM_TO_TYPE[gamevalEnum.trim().toUpperCase()] ?? gamevalEnum.toLowerCase();
  }
  return undefined;
}

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
    const labelRaw = typeof s.label === "string" ? s.label : null;
    const navLabelRaw = typeof s.navLabel === "string" ? s.navLabel : undefined;
    const displayNameRaw = typeof s.displayName === "string" ? s.displayName : undefined;
    const label = navLabelRaw ?? displayNameRaw ?? labelRaw;
    if (!id || !label) return [];
    const gamevalTypeRaw = typeof s.gamevalType === "string" ? s.gamevalType : undefined;
    const gamevalEnumRaw = typeof s.gamevalEnum === "string" ? s.gamevalEnum : undefined;
    return [
      {
        id,
        label,
        navLabel: navLabelRaw,
        displayName: displayNameRaw,
        apiType: typeof s.apiType === "string" ? s.apiType : undefined,
        minRevision: typeof s.minRevision === "number" ? s.minRevision : undefined,
        gamevalType: normalizeGamevalType(gamevalTypeRaw, gamevalEnumRaw),
        gamevalEnum: gamevalEnumRaw,
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
    const label =
      (typeof g.displayName === "string" ? g.displayName : null) ??
      (typeof g.label === "string" ? g.label : null);
    const minRevision = typeof g.minRevision === "number" ? g.minRevision : 0;
    if (!id || !label) return [];
    return [{ id, label, minRevision } satisfies GamevalGroup];
  });
}
