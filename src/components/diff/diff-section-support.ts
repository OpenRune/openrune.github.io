export type SectionSupportManifest = {
  rev: number;
  archives: Record<string, boolean>;
  configs: Record<string, boolean>;
  /** Lightweight totals from decoded bins (Full mode badges — no full id list). */
  archiveCounts?: {
    sprites?: number;
    textures?: number;
  };
};

export function parseSectionSupportManifest(data: unknown): SectionSupportManifest | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  if (typeof raw.rev !== "number") return null;
  if (!raw.archives || typeof raw.archives !== "object") return null;
  if (!raw.configs || typeof raw.configs !== "object") return null;

  const parseBoolMap = (value: unknown): Record<string, boolean> => {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
        typeof v === "boolean" ? [[k, v]] : [],
      ),
    );
  };

  const archiveCounts = (() => {
    const counts = raw.counts;
    if (!counts || typeof counts !== "object") return undefined;
    const archives = (counts as Record<string, unknown>).archives;
    if (!archives || typeof archives !== "object") return undefined;
    const a = archives as Record<string, unknown>;
    const sprites = typeof a.sprites === "number" && Number.isFinite(a.sprites) ? Math.trunc(a.sprites) : undefined;
    const textures =
      typeof a.textures === "number" && Number.isFinite(a.textures) ? Math.trunc(a.textures) : undefined;
    if (sprites == null && textures == null) return undefined;
    return { sprites, textures };
  })();

  return {
    rev: raw.rev,
    archives: parseBoolMap(raw.archives),
    configs: parseBoolMap(raw.configs),
    ...(archiveCounts ? { archiveCounts } : {}),
  };
}
