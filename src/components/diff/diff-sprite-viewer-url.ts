import type { InspectorChangeKind } from "./diff-inspector-panel";

/** Open sprite id in the PNG viewer (`?sprite=704`). */
export const DIFF_URL_PARAM_SPRITE = "sprite";
export const DIFF_URL_PARAM_SPRITE_KIND = "spriteKind";
export const DIFF_URL_PARAM_SPRITE_MODE = "spriteMode";
export const DIFF_URL_PARAM_SPRITE_ZOOM = "spriteZoom";
export const DIFF_URL_PARAM_SPRITE_SWIPE = "spriteSwipe";
export const DIFF_URL_PARAM_SPRITE_OPACITY = "spriteOpacity";

export const SPRITE_VIEWER_URL_PARAMS = [
  DIFF_URL_PARAM_SPRITE,
  DIFF_URL_PARAM_SPRITE_KIND,
  DIFF_URL_PARAM_SPRITE_MODE,
  DIFF_URL_PARAM_SPRITE_ZOOM,
  DIFF_URL_PARAM_SPRITE_SWIPE,
  DIFF_URL_PARAM_SPRITE_OPACITY,
] as const;

export type SpriteViewerCompareMode = "swipe" | "overlay" | "side";
export type SpriteViewerZoomMode = "fit" | "pixel" | "manual";

export type SpriteViewerUrlState = {
  spriteId: number | null;
  kind: InspectorChangeKind | null;
  mode: SpriteViewerCompareMode | null;
  zoomMode: SpriteViewerZoomMode | null;
  manualScale: number | null;
  swipePct: number | null;
  overlayOpacity: number | null;
};

function parsePositiveInt(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

function parsePct(raw: string | null): number | null {
  const n = parsePositiveInt(raw);
  if (n == null) return null;
  return Math.min(100, Math.max(0, n));
}

export function parseSpriteViewerUrlState(searchParams: URLSearchParams | { get: (key: string) => string | null }): SpriteViewerUrlState {
  const modeRaw = searchParams.get(DIFF_URL_PARAM_SPRITE_MODE)?.trim().toLowerCase() ?? null;
  const mode: SpriteViewerCompareMode | null =
    modeRaw === "swipe" || modeRaw === "overlay" || modeRaw === "side" ? modeRaw : null;

  const kindRaw = searchParams.get(DIFF_URL_PARAM_SPRITE_KIND)?.trim().toLowerCase() ?? null;
  const kind: InspectorChangeKind | null =
    kindRaw === "added" || kindRaw === "changed" || kindRaw === "removed" ? kindRaw : null;

  const zoomRaw = searchParams.get(DIFF_URL_PARAM_SPRITE_ZOOM)?.trim().toLowerCase() ?? null;
  let zoomMode: SpriteViewerZoomMode | null = null;
  let manualScale: number | null = null;
  if (zoomRaw === "fit") {
    zoomMode = "fit";
  } else if (zoomRaw === "1" || zoomRaw === "1:1" || zoomRaw === "100") {
    zoomMode = "pixel";
    manualScale = 1;
  } else if (zoomRaw != null && zoomRaw !== "") {
    const pct = Number(zoomRaw);
    if (Number.isFinite(pct) && pct > 0) {
      zoomMode = "manual";
      manualScale = pct / 100;
    }
  }

  const opacityPct = parsePct(searchParams.get(DIFF_URL_PARAM_SPRITE_OPACITY));

  return {
    spriteId: parsePositiveInt(searchParams.get(DIFF_URL_PARAM_SPRITE)),
    kind,
    mode,
    zoomMode,
    manualScale,
    swipePct: parsePct(searchParams.get(DIFF_URL_PARAM_SPRITE_SWIPE)),
    overlayOpacity: opacityPct != null ? opacityPct / 100 : null,
  };
}

export function clearSpriteViewerParams(params: URLSearchParams): void {
  for (const key of SPRITE_VIEWER_URL_PARAMS) {
    params.delete(key);
  }
}

export function copySpriteViewerParams(from: { get: (key: string) => string | null }, to: URLSearchParams): void {
  for (const key of SPRITE_VIEWER_URL_PARAMS) {
    const v = from.get(key);
    if (v != null && v !== "") to.set(key, v);
  }
}

export function writeSpriteViewerParams(
  params: URLSearchParams,
  state: {
    spriteId: number;
    kind: InspectorChangeKind;
    mode: SpriteViewerCompareMode;
    zoomMode: SpriteViewerZoomMode;
    manualScale: number;
    swipePct: number;
    overlayOpacity: number;
  },
): void {
  params.set(DIFF_URL_PARAM_SPRITE, String(state.spriteId));
  params.set(DIFF_URL_PARAM_SPRITE_KIND, state.kind);
  params.set(DIFF_URL_PARAM_SPRITE_MODE, state.mode);

  if (state.zoomMode === "fit") {
    params.set(DIFF_URL_PARAM_SPRITE_ZOOM, "fit");
  } else if (state.zoomMode === "pixel") {
    params.set(DIFF_URL_PARAM_SPRITE_ZOOM, "1:1");
  } else {
    params.set(DIFF_URL_PARAM_SPRITE_ZOOM, String(Math.round(state.manualScale * 100)));
  }

  if (state.mode === "swipe") {
    params.set(DIFF_URL_PARAM_SPRITE_SWIPE, String(Math.round(state.swipePct)));
  } else {
    params.delete(DIFF_URL_PARAM_SPRITE_SWIPE);
  }

  if (state.mode === "overlay") {
    params.set(DIFF_URL_PARAM_SPRITE_OPACITY, String(Math.round(state.overlayOpacity * 100)));
  } else {
    params.delete(DIFF_URL_PARAM_SPRITE_OPACITY);
  }
}
