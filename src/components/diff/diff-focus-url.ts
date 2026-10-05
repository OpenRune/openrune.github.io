import { bareFocusTitle } from "./diff-focus-match";

/** Deep-link / quick-hop target, e.g. `?focus=item_33428` or `?focus=33428`. */
export const DIFF_URL_PARAM_FOCUS = "focus";

/** Normalize a focus query value to the bracket title used by viewers (`[item_33428]`). */
export function focusUrlToBracketTitle(raw: string | null | undefined): string | null {
  const bare = bareFocusTitle(raw?.trim() ?? "");
  if (!bare) return null;
  return `[${bare}]`;
}

/** Compact value stored in the URL (no brackets). */
export function focusBracketTitleToUrlValue(bracketTitle: string): string {
  return bareFocusTitle(bracketTitle);
}

export function parseFocusUrlParam(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
): string | null {
  return focusUrlToBracketTitle(searchParams.get(DIFF_URL_PARAM_FOCUS));
}

export function writeFocusParam(params: URLSearchParams, bracketTitle: string): void {
  const value = focusBracketTitleToUrlValue(bracketTitle);
  if (!value) {
    params.delete(DIFF_URL_PARAM_FOCUS);
    return;
  }
  params.set(DIFF_URL_PARAM_FOCUS, value);
}

export function clearFocusParam(params: URLSearchParams): void {
  params.delete(DIFF_URL_PARAM_FOCUS);
}

export function copyFocusParam(
  from: { get: (key: string) => string | null },
  to: URLSearchParams,
): void {
  const v = from.get(DIFF_URL_PARAM_FOCUS);
  if (v != null && v.trim() !== "") to.set(DIFF_URL_PARAM_FOCUS, v.trim());
}
