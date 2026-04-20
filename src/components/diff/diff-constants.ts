import { GAMEVAL_TYPE_MAP, type GamevalType } from "@/context/gameval-context";
import type { NavConfig } from "@/lib/nav-config";

import type { ConfigLine, ConfigRow, DiffMode, GamevalsFullSection, Section } from "./diff-types";

/** Revisions below this do not expose gameval extras on the cache server (sprites, archives, etc.). */
export const GAMEVAL_MIN_REVISION = 230;

/** Var client script gamevals exist from this revision onward (cache server). */
export const GAMEVAL_VARCS_MIN_REVISION = 232;

/** Tab / URL suffix order for the combined gamevals explorer (matches `GAMEVAL_TYPE_MAP` insertion order). */
export const GAMEVAL_FULL_TAB_ORDER: readonly GamevalType[] = Object.values(GAMEVAL_TYPE_MAP) as GamevalType[];

/** Every `section=gamevals_*` value derived from `GAMEVAL_TYPE_MAP`. */
export const GAMEVAL_FULL_SECTIONS: readonly GamevalsFullSection[] = GAMEVAL_FULL_TAB_ORDER.map(
  (tab) => `gamevals_${tab}` as GamevalsFullSection,
);

/** Width wrapper for combined diff search (sprites full view, config table, …). */
export const DIFF_COMBINED_SEARCH_WRAP_CLASS = "mb-3 w-[40%] min-w-[24rem] max-w-[48rem] shrink-0";

/** App Router path for the combined (“Full”) config explorer. */
export const DIFF_ROUTE_FULL = "/diff/full";
/** App Router path for the base/compare diff explorer. */
export const DIFF_ROUTE_DIFFVIEW = "/diff/diffview";

/** Query keys for sharable revision state on `/diff/full` and `/diff/diffview`. */
export const DIFF_URL_PARAM_REV = "rev";
/** Diff workbench: older/base revision (maps to `baseRev` state). */
export const DIFF_URL_PARAM_BASE = "base";
/** Diff workbench: newer revision to compare against base (maps to `rev` state). */
export const DIFF_URL_PARAM_COMPARE = "compare";
/** @deprecated Old query key; still accepted when reading URLs. Prefer {@link DIFF_URL_PARAM_BASE}. */
export const DIFF_URL_PARAM_FROM = "from";
/** @deprecated Old query key; still accepted when reading URLs. Prefer {@link DIFF_URL_PARAM_COMPARE}. */
export const DIFF_URL_PARAM_TO = "to";
export const DIFF_URL_PARAM_SECTION = "section";

/** Initial section when opening `/diff/full` with no `section` query (prefer lighter inventories over items). */
export const DIFF_DEFAULT_SECTION: Section = "inv";

/** Serialized revision query for the current mode (`rev` when pinned full, else `base`/`compare`). */
export function diffRevisionQueryForMode(
  mode: DiffMode,
  viewRev: "latest" | number,
  baseRev: number,
  rev: number,
  latestRevision: number,
): string {
  const p = new URLSearchParams();
  if (mode === "combined") {
    const pinned =
      viewRev === "latest" || viewRev === latestRevision ? null : viewRev;
    if (pinned != null) p.set(DIFF_URL_PARAM_REV, String(pinned));
  } else {
    p.set(DIFF_URL_PARAM_BASE, String(baseRev));
    p.set(DIFF_URL_PARAM_COMPARE, String(rev));
  }
  return p.toString();
}

let apiTypeToSectionId: Record<string, string> = {
  spotanims: "spotanim",
  params: "param",
};
let sectionGamevalType: Record<string, GamevalType> = {};

export let CONFIG_TYPES: Section[] = [];

export function normalizeSectionIdFromApiType(rawType: string): string {
  const t = rawType.trim().toLowerCase();
  return apiTypeToSectionId[t] ?? t;
}

/** Optional primary gameval type for a section (from `/cache/nav`). */
export function sectionGamevalTypeForSection(section: string): GamevalType | null {
  const key = section.trim().toLowerCase();
  return sectionGamevalType[key] ?? null;
}

function singularizeSectionPrefix(sectionId: string): string {
  const s = sectionId.trim().toLowerCase();
  if (s.endsWith("ies") && s.length > 3) return `${s.slice(0, -3)}y`;
  if (s.endsWith("s") && s.length > 1) return s.slice(0, -1);
  return s;
}

/** Normalize a config type string for the cache API (handles singular-to-plural aliases). */
export function normalizeConfigTypeForCacheApi(configType: string): string {
  const normalized = configType.trim().toLowerCase();
  if (normalized === "spotanim") return "spotanims";
  if (normalized === "param") return "params";
  return configType;
}

/** Prefix used for `[prefix_id]` headers in combined cache text rendering. */
export function sectionPrefixForConfigType(rawType: string): string {
  return singularizeSectionPrefix(normalizeSectionIdFromApiType(rawType));
}

/** Apply `/cache/nav` config section ids (and apiType aliases) at runtime. */
export function applyNavConfigSections(navConfig: NavConfig | null): void {
  if (!navConfig || !Array.isArray(navConfig.configs) || navConfig.configs.length === 0) {
    CONFIG_TYPES = [];
    apiTypeToSectionId = {
      spotanims: "spotanim",
      params: "param",
    };
    sectionGamevalType = {};
    DIFF_ALL_SECTIONS = [
      "sprites",
      "textures",
      "gamevals",
      ...GAMEVAL_FULL_SECTIONS,
      ...CONFIG_TYPES,
    ];
    return;
  }

  const nextConfigTypes = [...new Set(navConfig.configs.map((s) => s.id.trim().toLowerCase()).filter(Boolean))] as Section[];
  CONFIG_TYPES = nextConfigTypes;

  const nextApiTypeMap: Record<string, string> = {
    spotanims: "spotanim",
    params: "param",
  };
  const nextSectionGamevalType: Record<string, GamevalType> = {};
  navConfig.configs.forEach((section) => {
    const id = section.id.trim().toLowerCase();
    if (!id) return;
    nextApiTypeMap[id] = id;
    const apiType = section.apiType?.trim().toLowerCase();
    if (apiType) nextApiTypeMap[apiType] = id;
    const gamevalType = section.gamevalType?.trim().toLowerCase();
    if (gamevalType) nextSectionGamevalType[id] = gamevalType;
  });
  apiTypeToSectionId = nextApiTypeMap;
  sectionGamevalType = nextSectionGamevalType;

  DIFF_ALL_SECTIONS = [
    "sprites",
    "textures",
    "gamevals",
    ...GAMEVAL_FULL_SECTIONS,
    ...CONFIG_TYPES,
  ];
}

/** Every sidebar tab value (sprites, archives, configs). */
export let DIFF_ALL_SECTIONS: Section[] = [
  "sprites",
  "textures",
  "gamevals",
  ...GAMEVAL_FULL_SECTIONS,
  ...CONFIG_TYPES,
];

export function isDiffSectionId(s: string): s is Section {
  return (DIFF_ALL_SECTIONS as readonly string[]).includes(s);
}

/** Non-empty URL `section` value → tab ({@link DIFF_DEFAULT_SECTION} when unknown / gamevals unavailable). */
export function resolveDiffSectionFromUrl(
  raw: string,
  archivesGamevalEnabled: boolean,
  activeGamevalRevision: number,
): Section {
  if (!isDiffSectionId(raw)) return DIFF_DEFAULT_SECTION;
  /** Old canonical URL used `gamevals_items` for the combined explorer. */
  if (raw === "gamevals_items") {
    return archivesGamevalEnabled ? "gamevals" : DIFF_DEFAULT_SECTION;
  }
  if (raw === "gamevals") {
    return archivesGamevalEnabled ? "gamevals" : DIFF_DEFAULT_SECTION;
  }
  if (raw.startsWith("gamevals_")) {
    if (!archivesGamevalEnabled) return DIFF_DEFAULT_SECTION;
    const suffix = raw.slice("gamevals_".length);
    if (!GAMEVAL_FULL_TAB_ORDER.includes(suffix as GamevalType)) return DIFF_DEFAULT_SECTION;
    if (suffix === "varcs" && activeGamevalRevision < GAMEVAL_VARCS_MIN_REVISION) {
      return "gamevals";
    }
    return raw as Section;
  }
  return raw as Section;
}

/** Full query string for diff workbench (revision + optional `section`). */
export function diffWorkbenchSearchString(opts: {
  mode: DiffMode;
  viewRev: "latest" | number;
  baseRev: number;
  rev: number;
  latestRevision: number;
  section: Section;
}): string {
  const revPart = diffRevisionQueryForMode(
    opts.mode,
    opts.viewRev,
    opts.baseRev,
    opts.rev,
    opts.latestRevision,
  );
  const p = new URLSearchParams(revPart);
  if (opts.section !== DIFF_DEFAULT_SECTION) p.set(DIFF_URL_PARAM_SECTION, opts.section);
  return p.toString();
}

/** Sidebar link to Full: when already in Diff, pin the Compare revision on Full. */
export function diffSidebarFullHref(
  diffViewMode: DiffMode,
  viewRev: "latest" | number,
  compareRev: number,
  latestRevision: number,
  section: Section,
): string {
  const combinedViewRev: "latest" | number =
    diffViewMode === "diff"
      ? compareRev === latestRevision
        ? "latest"
        : compareRev
      : viewRev === "latest" || viewRev === latestRevision
        ? "latest"
        : viewRev;
  const qs = diffWorkbenchSearchString({
    mode: "combined",
    viewRev: combinedViewRev,
    baseRev: 0,
    rev: 0,
    latestRevision,
    section,
  });
  return qs ? `${DIFF_ROUTE_FULL}?${qs}` : DIFF_ROUTE_FULL;
}

export function diffSidebarDiffHref(baseRev: number, rev: number, latestRevision: number, section: Section): string {
  const qs = diffWorkbenchSearchString({
    mode: "diff",
    viewRev: "latest",
    baseRev,
    rev,
    latestRevision,
    section,
  });
  return qs ? `${DIFF_ROUTE_DIFFVIEW}?${qs}` : DIFF_ROUTE_DIFFVIEW;
}

/** Offline fallback when `GET diff/revisions` is unavailable. */
export const REVISIONS_FALLBACK = [1, 100, 180, 220, 260];

/**
 * Greatest revision present in `sortedAsc` that is strictly less than `highExclusive`.
 * Expects `sortedAsc` sorted ascending with unique entries (diff revisions list).
 */
export function greatestListedRevisionBelow(
  sortedAsc: readonly number[],
  highExclusive: number,
): number | null {
  if (sortedAsc.length === 0 || highExclusive <= sortedAsc[0]!) return null;
  let lo = 0;
  let hi = sortedAsc.length - 1;
  let ans: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = sortedAsc[mid]!;
    if (v < highExclusive) {
      ans = v;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/**
 * Default Diff sidebar pair: **Base** = newest build in the list; **Compare** = the newest listed build
 * strictly below Base (the next lower revision that actually exists — not `base - 1` when IDs skip).
 */
export function defaultDiffRevisionPair(sortedAsc: readonly number[]): { baseRev: number; compareRev: number } {
  const fb = REVISIONS_FALLBACK;
  if (sortedAsc.length === 0) {
    const latestFb = fb[fb.length - 1]!;
    const belowFb = greatestListedRevisionBelow(fb, latestFb) ?? latestFb;
    return { baseRev: latestFb, compareRev: belowFb };
  }
  const latest = sortedAsc[sortedAsc.length - 1]!;
  const below = greatestListedRevisionBelow(sortedAsc, latest);
  return { baseRev: latest, compareRev: below ?? latest };
}

/** Same packing as JVM: `(interfaceId shl 16) or subChildId`. */
export function interfaceComponentCombinedId(interfaceId: number, childId: number): number {
  return (interfaceId << 16) | childId;
}

export const SPRITE_PER_PAGE_OPTIONS = [105, 150, 200, 250, 300].sort((a, b) => b - a) as readonly number[];

/** Same paging options as sprites (archive-style combined table). */
export const TEXTURE_PER_PAGE_OPTIONS = SPRITE_PER_PAGE_OPTIONS;

export const SPRITE_DIFF_ADDED = [4, 8, 15, 16, 23, 42, 55, 87];
export const SPRITE_DIFF_CHANGED = [5, 17, 66, 88, 101, 122];
export const SPRITE_DIFF_REMOVED = [2, 14, 18, 77];

const GAMEVALS_CONFIG_PREVIEW_ROWS: ConfigRow[] = [
  { id: 1127, type: "context", entries: { name: "RUNE_PLATEBODY" } },
  { id: 4151, type: "context", entries: { name: "ABYSSAL_WHIP" } },
];

const GAMEVALS_CONFIG_PREVIEW_LINES: ConfigLine[] = [
  { type: "context", line: "1127=RUNE_PLATEBODY" },
  { type: "context", line: "4151=ABYSSAL_WHIP" },
];

const GAMEVALS_FULL_ROWS_BY_SECTION = Object.fromEntries(
  GAMEVAL_FULL_SECTIONS.map((s) => [s, GAMEVALS_CONFIG_PREVIEW_ROWS] as const),
) as Record<GamevalsFullSection, ConfigRow[]>;

const GAMEVALS_FULL_LINES_BY_SECTION = Object.fromEntries(
  GAMEVAL_FULL_SECTIONS.map((s) => [s, GAMEVALS_CONFIG_PREVIEW_LINES] as const),
) as Record<GamevalsFullSection, ConfigLine[]>;

export const CONFIG_FULL_ROWS: Record<Section, ConfigRow[]> = {
  sprites: [],
  gamevals: [],
  textures: [
    { id: 0, type: "context", entries: { averageRgb: "127", animationDirection: "0", animationSpeed: "2" } },
    { id: 1, type: "context", entries: { averageRgb: "216", animationDirection: "1", animationSpeed: "4" } },
  ],
  items: [
    { id: 1127, type: "context", entries: { name: "Rune platebody", gameval: "RUNE_PLATEBODY", noted: "false" } },
    { id: 11840, type: "context", entries: { name: "Dragon boots", gameval: "DRAGON_BOOTS", noted: "false" } },
    { id: 4151, type: "context", entries: { name: "Abyssal whip", gameval: "ABYSSAL_WHIP", noted: "false" } },
  ],
  objects: [
    { id: 100, type: "context", entries: { name: "Door", gameval: "DOOR" } },
    { id: 2091, type: "context", entries: { name: "Bank booth", gameval: "BANK_BOOTH" } },
  ],
  param: [
    { id: 3500, type: "context", entries: { type: "int", ismembers: "false", defaultInt: "0", defaultString: "", defaultLong: "0" } },
    { id: 3501, type: "context", entries: { type: "string", ismembers: "true", defaultInt: "0", defaultString: "", defaultLong: "0" } },
    { id: 3502, type: "context", entries: { type: "long", ismembers: "false", defaultInt: "0", defaultString: "", defaultLong: "0" } },
  ],
  npcs: [
    { id: 7413, type: "context", entries: { name: "Commander Zilyana", gameval: "COMMANDER_ZILYANA" } },
    { id: 6611, type: "context", entries: { name: "Cerberus", gameval: "CERBERUS" } },
  ],
  sequences: [
    { id: 1105, type: "context", entries: { gameval: "HUMAN_WALK", tickDuration: "4 ticks (2.4s)" } },
    { id: 1205, type: "context", entries: { gameval: "DRAGON_BREATH", tickDuration: "6 ticks (3.6s)" } },
  ],
  spotanim: [
    { id: 369, type: "context", entries: { gameval: "ICE_BARRAGE", tickDuration: "5 ticks (3.0s)" } },
    { id: 1875, type: "context", entries: { gameval: "VENGEANCE", tickDuration: "4 ticks (2.4s)" } },
  ],
  inv: [
    { id: 93, type: "context", entries: { gameval: "BANK_MAIN", size: "816" } },
    { id: 149, type: "context", entries: { gameval: "SEED_VAULT", size: "250" } },
  ],
  overlay: [
    { id: 32, type: "context", entries: { colour: "9533", texture: "12" } },
    { id: 45, type: "context", entries: { colour: "11783", texture: "14" } },
  ],
  underlay: [
    { id: 2, type: "context", entries: { rgb: "8221" } },
    { id: 3, type: "context", entries: { rgb: "16220" } },
  ],
  ...GAMEVALS_FULL_ROWS_BY_SECTION,
};

export const CONFIG_DIFF_LINES: Record<Section, ConfigLine[]> = {
  sprites: [],
  gamevals: [],
  textures: [
    { type: "context", line: "// 12" },
    { type: "change", line: "averageRgb=17211" },
    { type: "change", line: "animationSpeed=4" },
    { type: "context", line: "" },
    { type: "context", line: "// 13" },
    { type: "add", line: "averageRgb=9711" },
    { type: "add", line: "animationSpeed=2" },
  ],
  items: [
    { type: "context", line: "// 1127" },
    { type: "change", line: "name=Rune platebody" },
    { type: "change", line: "cost=65000" },
    { type: "context", line: "gameval=RUNE_PLATEBODY" },
    { type: "context", line: "" },
    { type: "context", line: "// 4151" },
    { type: "removed", line: "cost=120000" },
    { type: "add", line: "cost=135000" },
  ],
  objects: [
    { type: "context", line: "// 2091" },
    { type: "change", line: "name=Bank booth" },
    { type: "context", line: "gameval=BANK_BOOTH" },
  ],
  param: [
    { type: "context", line: "// 3500" },
    { type: "change", line: "type=int" },
    { type: "context", line: "defaultInt=0" },
  ],
  npcs: [
    { type: "context", line: "// 7413" },
    { type: "change", line: "combatLevel=596" },
    { type: "context", line: "name=Commander Zilyana" },
  ],
  sequences: [
    { type: "context", line: "// 1105" },
    { type: "change", line: "lengthInCycles=4" },
    { type: "context", line: "gameval=HUMAN_WALK" },
  ],
  spotanim: [
    { type: "context", line: "// 369" },
    { type: "change", line: "lengthInCycles=5" },
    { type: "context", line: "gameval=ICE_BARRAGE" },
  ],
  inv: [
    { type: "context", line: "// 93" },
    { type: "change", line: "size=816" },
    { type: "context", line: "gameval=BANK_MAIN" },
  ],
  overlay: [
    { type: "context", line: "// 45" },
    { type: "change", line: "colour=11783" },
    { type: "add", line: "texture=14" },
  ],
  underlay: [
    { type: "context", line: "// 3" },
    { type: "change", line: "rgb=16220" },
  ],
  ...GAMEVALS_FULL_LINES_BY_SECTION,
};

export const DELTA_COUNTS: Record<string, { added: number; changed: number; removed: number }> = {
  sprites: { added: SPRITE_DIFF_ADDED.length, changed: SPRITE_DIFF_CHANGED.length, removed: SPRITE_DIFF_REMOVED.length },
  textures: { added: 4, changed: 12, removed: 0 },
  gamevals: { added: 19, changed: 36, removed: 2 },
  items: { added: 19, changed: 36, removed: 2 },
  objects: { added: 4, changed: 11, removed: 1 },
  param: { added: 1, changed: 3, removed: 0 },
  npcs: { added: 2, changed: 7, removed: 1 },
  sequences: { added: 1, changed: 9, removed: 0 },
  spotanim: { added: 2, changed: 4, removed: 0 },
  inv: { added: 0, changed: 3, removed: 0 },
  overlay: { added: 2, changed: 5, removed: 1 },
  underlay: { added: 0, changed: 2, removed: 0 },
};
