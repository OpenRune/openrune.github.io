/** Small document.cookie helpers for UI preferences that should outlive a tab. */

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  for (const entry of document.cookie.split(";")) {
    const trimmed = entry.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return undefined;
}

export function writeCookie(name: string, value: string, maxAgeSeconds = ONE_YEAR_SECONDS): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}` +
    `; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}
