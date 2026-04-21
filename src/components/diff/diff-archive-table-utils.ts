/**
 * Config table cells store Jagex **packed HSL** as an integer (same value `RsColorBox` / `jagexHslToHex` expect).
 * Parse only as a number — no hex conversion.
 */
export function parsePackedHslValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).trim());
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  if (!Number.isInteger(n)) return null;
  if (n < -1) return null;
  return n;
}
