/** Helpers for word-wrapped virtualized dump/diff text rows. */

const MONO_XS_CHAR_PX = 7.2;
const LINE_PAD_X = 24; // px-3 both sides
const MINIMAP_GUTTER_PX = 12;

export function estimateCharsPerLine(containerWidth: number, columns = 1): number {
  const usable = Math.max(40, containerWidth - LINE_PAD_X - MINIMAP_GUTTER_PX);
  const perCol = columns > 1 ? usable / columns - 8 : usable;
  return Math.max(8, Math.floor(perCol / MONO_XS_CHAR_PX));
}

/** Visual line count for a dump row when word-wrap is on. */
export function estimateWrappedRowUnits(text: string, charsPerLine: number): number {
  if (charsPerLine <= 0) return 1;
  const raw = text || " ";
  let units = 0;
  // Soft-wrap each physical line independently.
  for (const part of raw.split("\n")) {
    const len = Math.max(part.length, 1);
    units += Math.max(1, Math.ceil(len / charsPerLine));
  }
  return Math.max(1, units);
}

export function buildPrefixOffsets(heights: readonly number[]): number[] {
  const out = new Array<number>(heights.length + 1);
  out[0] = 0;
  for (let i = 0; i < heights.length; i++) {
    out[i + 1] = out[i]! + heights[i]!;
  }
  return out;
}

/** Largest index with prefix[i] <= value (for scrollTop → row). */
export function findRowAtOffset(prefix: readonly number[], offset: number): number {
  if (prefix.length <= 1) return 0;
  let lo = 0;
  let hi = prefix.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (prefix[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function virtualWindowFromOffsets(
  prefix: readonly number[],
  scrollTop: number,
  viewportH: number,
  overscan: number,
): { start: number; end: number; topPx: number; totalH: number } {
  const n = Math.max(0, prefix.length - 1);
  if (n === 0) return { start: 0, end: 0, topPx: 0, totalH: 0 };
  const totalH = prefix[n]!;
  const ch = Math.max(viewportH, 1);
  const start = Math.max(0, findRowAtOffset(prefix, scrollTop) - overscan);
  const endExclusive = Math.min(n, findRowAtOffset(prefix, scrollTop + ch) + 1 + overscan);
  return { start, end: endExclusive, topPx: prefix[start]!, totalH };
}
