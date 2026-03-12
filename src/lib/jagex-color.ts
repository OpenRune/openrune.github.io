export type JagexHsl = {
  hue: number;
  saturation: number;
  lightness: number;
};

export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type HslColor = {
  h: number;
  s: number;
  l: number;
};

const MAX_HUE = 63;
const MAX_SATURATION = 7;
const MAX_LIGHTNESS = 127;
const MAX_PACKED_HSL = 65535;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampPackedHsl(value: number): number {
  return clamp(Math.round(value), 0, MAX_PACKED_HSL);
}

export function packJagexHsl(hue: number, saturation: number, lightness: number): number {
  const h = clamp(Math.round(hue), 0, MAX_HUE);
  const s = clamp(Math.round(saturation), 0, MAX_SATURATION);
  const l = clamp(Math.round(lightness), 0, MAX_LIGHTNESS);
  return (h << 10) | (s << 7) | l;
}

/**
 * Unpack Jagex packed HSL (6 + 3 + 7 bits). Matches openrune `unpackJagexHSL`: **bit masks only** — do not
 * clamp to 16 bits first; cache dumps may carry extra high bits and values like `11184810` must unpack
 * the same way as the reference client / openrune.github.io.
 */
export function unpackJagexHsl(packed: number): JagexHsl {
  const value = Number.isFinite(packed) ? Math.trunc(packed) : 0;
  return {
    hue: (value >> 10) & 0b111111,
    saturation: (value >> 7) & 0b111,
    lightness: value & 0b1111111,
  };
}

export function jagexHslToStandardHsl(packed: number): HslColor {
  const { hue, saturation, lightness } = unpackJagexHsl(packed);
  return {
    h: Math.round((hue / MAX_HUE) * 360),
    s: Math.round((saturation / MAX_SATURATION) * 100),
    l: Math.round((lightness / MAX_LIGHTNESS) * 100),
  };
}

export function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = (clamp(hue, 0, MAX_HUE) / MAX_HUE) * 360;
  const s = (clamp(saturation, 0, MAX_SATURATION) / MAX_SATURATION) * 100;
  const l = (clamp(lightness, 0, MAX_LIGHTNESS) / MAX_LIGHTNESS) * 100;

  const chroma = (1 - Math.abs((2 * l) / 100 - 1)) * (s / 100);
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l / 100 - chroma / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [chroma, x, 0];
  else if (h < 120) [r, g, b] = [x, chroma, 0];
  else if (h < 180) [r, g, b] = [0, chroma, x];
  else if (h < 240) [r, g, b] = [0, x, chroma];
  else if (h < 300) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function jagexHslToHex(packed: number): string {
  const { hue, saturation, lightness } = unpackJagexHsl(packed);
  return hslToHex(hue, saturation, lightness);
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function jagexHslToRgb(packed: number): RgbColor {
  return hexToRgb(jagexHslToHex(packed));
}

function rgbToHsl(r: number, g: number, b: number): HslColor {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / delta + 2) * 60;
    else h = ((rn - gn) / delta + 4) * 60;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function rgbToJagexHsl(r: number, g: number, b: number): number {
  const { h, s, l } = rgbToHsl(r, g, b);
  const hue = Math.round((clamp(h, 0, 360) / 360) * MAX_HUE);
  const saturation = Math.round((clamp(s, 0, 100) / 100) * MAX_SATURATION);
  const lightness = Math.round((clamp(l, 0, 100) / 100) * MAX_LIGHTNESS);
  return packJagexHsl(hue, saturation, lightness);
}

export function hexToJagexHsl(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return rgbToJagexHsl(r, g, b);
}
