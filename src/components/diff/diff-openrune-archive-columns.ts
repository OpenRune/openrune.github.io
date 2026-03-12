import type { ConfigArchiveTableRow } from "./diff-config-archive-types";
import { GAMEVAL_MIN_REVISION } from "./diff-constants";
import type { Section } from "./diff-types";

export type ArchiveEntitySection =
  | "items"
  | "npcs"
  | "sequences"
  | "spotanim"
  | "overlay"
  | "underlay";

export const ARCHIVE_ENTITY_SECTIONS = [
  "items",
  "npcs",
  "sequences",
  "spotanim",
  "overlay",
  "underlay",
] as const satisfies readonly ArchiveEntitySection[];

export function isArchiveEntitySection(section: Section): section is ArchiveEntitySection {
  return (ARCHIVE_ENTITY_SECTIONS as readonly string[]).includes(section);
}

/** Column key order + derived fields aligned with `D:\\openrune.github.io\\app\\diff\\page.tsx` + `ConfigTableView`. */

export function openruneColumnHeaderLabel(key: string): string {
  if (key === "tickDuration") return "Tick Duration";
  if (key === "animationId") return "Animation";
  return key;
}

function collectKeysFromRows(rows: ConfigArchiveTableRow[]): Set<string> {
  const keys = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r.entries)) keys.add(k);
  }
  return keys;
}

/** Textures: `isTransparent`, `averageRgb`, `animationDirection`, `animationSpeed`, then remaining keys sorted. */
export function openruneTextureArchiveColumnKeys(rows: ConfigArchiveTableRow[]): string[] {
  const keys = collectKeysFromRows(rows);
  const textureOrder = ["isTransparent", "averageRgb", "animationDirection", "animationSpeed"] as const;
  const ordered = textureOrder.filter((k) => {
    if (k === "isTransparent") return keys.has("isTransparent") || keys.has("transparent");
    return keys.has(k);
  });
  const rest = [...keys].filter((k) => {
    if (textureOrder.includes(k as (typeof textureOrder)[number])) return false;
    if (k === "transparent") return false;
    return true;
  });
  rest.sort();
  return [...ordered, ...rest];
}

/** Inventory: gameval first when supported, then other keys sorted (openrune). */
export function openruneInvArchiveColumnKeys(rows: ConfigArchiveTableRow[], combinedRev: number): string[] {
  const keys = collectKeysFromRows(rows);
  const rest = [...keys].filter((k) => k !== "gameval").sort();
  return combinedRev >= GAMEVAL_MIN_REVISION ? ["gameval", ...rest] : rest;
}

function entriesWithTickDuration(row: ConfigArchiveTableRow): Record<string, string> {
  return {
    ...row.entries,
    tickDuration: row.entries.lengthInCycles ?? row.entries.tickDuration ?? "",
  };
}

/**
 * Config table columns for entity sections (items, npcs, sequences, spotanim, overlay, underlay).
 * Matches openrune `configTableColumns` / `ConfigTableView.displayColumns`.
 */
export function openruneEntityArchiveColumnKeys(
  section: ArchiveEntitySection,
  rows: ConfigArchiveTableRow[],
  combinedRev: number,
): string[] {
  const gv = combinedRev >= GAMEVAL_MIN_REVISION;
  const keys = new Set<string>();
  for (const r of rows) {
    const e = section === "sequences" || section === "spotanim" ? entriesWithTickDuration(r) : r.entries;
    for (const k of Object.keys(e)) keys.add(k);
  }

  if (section === "sequences") {
    keys.add("tickDuration");
    return gv ? ["gameval", "tickDuration"] : ["tickDuration"];
  }
  if (section === "spotanim") {
    keys.add("tickDuration");
    const hasAnimId = keys.has("animationId");
    if (gv) return hasAnimId ? ["gameval", "animationId", "tickDuration"] : ["gameval", "tickDuration"];
    return hasAnimId ? ["animationId", "tickDuration"] : ["tickDuration"];
  }
  if (section === "npcs") {
    const order = gv ? (["name", "gameval"] as const) : (["name"] as const);
    return order.filter((k) => (k === "gameval" ? gv : keys.has(k)));
  }
  if (section === "items") {
    const order = gv ? (["name", "gameval", "noted"] as const) : (["name", "noted"] as const);
    return order.filter((k) => (k === "gameval" ? gv : keys.has(k)));
  }
  if (section === "overlay" || section === "underlay") {
    return [...keys].sort();
  }
  return [...keys].sort();
}
