import type { ConfigLine } from "./diff-types";
import { sectionPrefixForConfigType } from "./diff-constants";

/** Strip brackets from a focus title. */
export function bareFocusTitle(focusBracketTitle: string): string {
  return focusBracketTitle.trim().replace(/^\[|\]$/g, "");
}

/**
 * Prefer a stable gameval name for deep-links / hops; fall back to `type_id`
 * only when no gameval exists (ids can move across revisions).
 */
export function focusBracketTitleForEntity(opts: {
  id: number;
  section: string;
  gameval?: string | null;
}): string {
  const gameval = opts.gameval?.trim();
  if (gameval) return `[${gameval}]`;
  return `[${sectionPrefixForConfigType(opts.section)}_${opts.id}]`;
}

/**
 * Entity id from inspector-style focus titles (`[item_33428]`, `item_33428`, `33428`).
 * Returns null when the title looks like a plain gameval name without a trailing id.
 */
export function parseFocusEntityId(focusBracketTitle: string): number | null {
  const bare = bareFocusTitle(focusBracketTitle).toLowerCase();
  if (!bare) return null;
  if (/^\d+$/.test(bare)) {
    const n = Number.parseInt(bare, 10);
    return Number.isFinite(n) ? n : null;
  }
  // Synthetic dump ids look like `item_33428` / `sequence_13911` — not gameval names.
  // Gameval names can also contain underscores; only treat as id when the prefix is a
  // known singular section token and the suffix is all digits with no extra segments.
  const m = /^([a-z][a-z0-9]*)_(\d+)$/.exec(bare);
  if (!m) return null;
  const n = Number.parseInt(m[2]!, 10);
  return Number.isFinite(n) ? n : null;
}
/** True when a dump section title matches the inspector focus string (gameval or `type_id`). */
export function sectionTitleMatchesFocus(
  title: string,
  focusBracketTitle: string | null | undefined,
  entityId?: number | null,
): boolean {
  const focus = focusBracketTitle?.trim().toLowerCase() ?? "";
  if (!focus) return false;
  const t = title.toLowerCase();
  const bare = bareFocusTitle(focus);
  if (`[${t}]` === focus || t === bare) return true;
  const focusId = parseFocusEntityId(focus);
  if (focusId == null) return false;
  if (entityId != null && entityId === focusId) return true;
  // Fallback when only the title is available.
  if (t === String(focusId) || t.endsWith(`_${focusId}`)) return true;
  return false;
}

/** Index of the `// id` (or exact bracket) line to scroll to for an inspector jump. */
export function findConfigFocusLineIndex(
  lines: readonly ConfigLine[],
  focusBracketTitle: string,
  /** Optional id from gameval reverse-lookup when the focus string is a name. */
  resolvedEntityId?: number | null,
): number {
  const target = focusBracketTitle.trim().toLowerCase();
  if (!target) return -1;

  const exact = lines.findIndex((row) => row.line.trim().toLowerCase() === target);
  if (exact >= 0) return exact;

  const bare = bareFocusTitle(target).toLowerCase();
  const bareBracket = `[${bare}]`;
  const byBare = lines.findIndex((row) => row.line.trim().toLowerCase() === bareBracket);
  if (byBare >= 0) return byBare;

  const id = resolvedEntityId ?? parseFocusEntityId(target);
  if (id != null) {
    const idLine = `// ${id}`;
    const byId = lines.findIndex((row) => row.line.trim() === idLine);
    if (byId >= 0) return byId;
  }

  // Last resort: substring on comments / titles.
  return lines.findIndex((row) => {
    const line = row.line.toLowerCase();
    if (line.includes(bare)) return true;
    if (id != null && row.line.startsWith("// ") && line.includes(String(id))) return true;
    return false;
  });
}

/** Whether dump line `i` belongs to a section that matches the current find/focus needle. */
export function configLineMatchesFocusNeedle(
  lines: readonly ConfigLine[],
  i: number,
  needleRaw: string,
): boolean {
  const needle = needleRaw.trim().toLowerCase();
  if (!needle) return true;
  if (lines[i]?.line.toLowerCase().includes(needle)) return true;

  let sectionStart = 0;
  for (let k = 0; k <= i; k++) {
    if (lines[k]?.line.startsWith("// ")) sectionStart = k;
  }
  if (lines[sectionStart]?.line.toLowerCase().includes(needle)) return true;
  const titleIdx = sectionStart + 1;
  if (titleIdx < lines.length && lines[titleIdx]?.line.toLowerCase().includes(needle)) return true;

  const id = parseFocusEntityId(needle);
  if (id != null && lines[sectionStart]?.line.trim() === `// ${id}`) return true;

  return false;
}
