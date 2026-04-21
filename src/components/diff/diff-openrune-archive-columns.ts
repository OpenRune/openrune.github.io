import type { ConfigArchiveTableRow } from "./diff-config-archive-types";
import { CONFIG_TYPES, GAMEVAL_MIN_REVISION } from "./diff-constants";
import type { Section } from "./diff-types";

export type ParamSmartDefaultField = "defaultInt" | "defaultString" | "defaultLong";

function hasField(entries: Record<string, string>, key: ParamSmartDefaultField): boolean {
  return Object.prototype.hasOwnProperty.call(entries, key);
}

/** Identify which param default field should be shown in the combined `default` column. */
export function getParamSmartDefaultField(entries: Record<string, string>): ParamSmartDefaultField {
  const type = (entries.type ?? "").toUpperCase();

  if (type === "STRING") {
    if (hasField(entries, "defaultString")) return "defaultString";
    if (hasField(entries, "defaultInt")) return "defaultInt";
    if (hasField(entries, "defaultLong")) return "defaultLong";
    return "defaultString";
  }

  if (type === "LONG") {
    if (hasField(entries, "defaultLong")) return "defaultLong";
    if (hasField(entries, "defaultInt")) return "defaultInt";
    if (hasField(entries, "defaultString")) return "defaultString";
    return "defaultLong";
  }

  if (hasField(entries, "defaultInt")) return "defaultInt";
  if (hasField(entries, "defaultString")) return "defaultString";
  if (hasField(entries, "defaultLong")) return "defaultLong";
  return "defaultInt";
}

/** Extract the non-default value from param entries based on type. */
export function getParamSmartDefault(entries: Record<string, string>): string {
  const chosen = getParamSmartDefaultField(entries);
  const value = entries[chosen];
  if (value == null) return "—";
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined") {
    return "—";
  }
  return value;
}

export type ArchiveEntitySection =
  | "items"
  | "objects"
  | "npcs"
  | "sequences"
  | "spotanim"
  | "overlay"
  | "underlay"
  | "param"
  | (string & {});

export function getArchiveEntitySections(): ArchiveEntitySection[] {
  const dynamic = CONFIG_TYPES.map((id) => id.toLowerCase() as ArchiveEntitySection);
  return [...new Set(dynamic)];
}

export const ARCHIVE_ENTITY_SECTIONS = getArchiveEntitySections();

export function isArchiveEntitySection(section: Section): section is ArchiveEntitySection {
  return getArchiveEntitySections().includes(section.toLowerCase() as ArchiveEntitySection);
}

/** Column key order + derived fields aligned with `D:\\openrune.github.io\\app\\diff\\page.tsx` + `ConfigTableView`. */

export function openruneColumnHeaderLabel(key: string): string {
  if (key === "tickDuration") return "Tick Duration";
  if (key === "animationId") return "Animation";
  if (key === "valuesCount") return "Values Entries";
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

export type TableColumnPreference = string | readonly string[];

function resolvePreferredColumns(
  keys: Set<string>,
  gv: boolean,
  preferred: readonly TableColumnPreference[] | undefined,
): string[] {
  if (!preferred || preferred.length === 0) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of preferred) {
    const candidates = typeof item === "string" ? [item] : [...item];
    let picked: string | null = null;
    for (const candidate of candidates) {
      if (candidate === "gameval") {
        if (gv) {
          picked = "gameval";
          break;
        }
        continue;
      }
      if (keys.has(candidate)) {
        picked = candidate;
        break;
      }
    }
    if (!picked || seen.has(picked)) continue;
    seen.add(picked);
    out.push(picked);
  }
  return out;
}

/**
 * Config table columns for entity sections (items, npcs, sequences, spotanim, overlay, underlay).
 * Matches openrune `configTableColumns` / `ConfigTableView.displayColumns`.
 */
export function openruneEntityArchiveColumnKeys(
  section: ArchiveEntitySection,
  rows: ConfigArchiveTableRow[],
  combinedRev: number,
  hasGamevalType: boolean,
  preferredColumns?: readonly TableColumnPreference[],
): string[] {
  const gv = combinedRev >= GAMEVAL_MIN_REVISION;
  const showGameval = gv && hasGamevalType;
  const keys = new Set<string>();
  for (const r of rows) {
    const e = section === "sequences" || section === "spotanim" ? entriesWithTickDuration(r) : r.entries;
    for (const k of Object.keys(e)) keys.add(k);
  }

  const preferredResolved = resolvePreferredColumns(keys, showGameval, preferredColumns);
  return preferredResolved;
}
