export type DeltaBadgeCounts = { added: number; changed: number; removed: number };

export type DeltaBadgeMap = Record<string, DeltaBadgeCounts>;

/** Overlay live API counts onto a baseline map (unknown keys keep baseline values). */
export function mergeDeltaBadgeMaps(
  baseline: DeltaBadgeMap,
  configs: Record<string, { added?: unknown; changed?: unknown; removed?: unknown }> | undefined,
  spriteSummary: { added?: unknown; changed?: unknown; removed?: unknown } | undefined,
): DeltaBadgeMap {
  const out: DeltaBadgeMap = { ...baseline };
  if (configs) {
    for (const [k, v] of Object.entries(configs)) {
      if (!v || typeof v !== "object") continue;
      out[k] = {
        added: Number(v.added) || 0,
        changed: Number(v.changed) || 0,
        removed: Number(v.removed) || 0,
      };
    }
  }
  if (spriteSummary && typeof spriteSummary === "object") {
    out.sprites = {
      added: Number(spriteSummary.added) || 0,
      changed: Number(spriteSummary.changed) || 0,
      removed: Number(spriteSummary.removed) || 0,
    };
  }
  return out;
}
