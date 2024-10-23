// Pack HSL values into the custom Jagex 16-bit HSL format
export const packJagexHSL = (hue, saturation, lightness) => {
  // 6 bits for hue, 3 bits for saturation, 7 bits for lightness
  return (hue << (3 + 7)) | (saturation << 7) | lightness;
};

// Unpack the 16-bit Jagex HSL value into its components
export const unpackJagexHSL = (packedValue) => {
  const lightness = packedValue & 0b1111111; // 7 bits for lightness
  const saturation = (packedValue >> 7) & 0b111; // 3 bits for saturation
  const hue = (packedValue >> (7 + 3)) & 0b111111; // 6 bits for hue
  return { hue, saturation, lightness };
};


// Convert RGB to HSL (standard HSL format)
export const rgbToHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return { hue: h, saturation: s, lightness: l };
};

export const convertHexToJagexHSL = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return convertRgbToJagexHSL(r, g, b);
};

export const convertRgbToJagexHSL = (r, g, b) => {
  const { hue, saturation, lightness } = rgbToHsl(r, g, b);

  // Convert HSL to the Jagex packed format
  const packedHue = Math.round((hue / 360) * 63); // Scale hue to 0-63
  const packedSaturation = Math.round((saturation / 100) * 7); // Scale saturation to 0-7
  const packedLightness = Math.round((lightness / 100) * 127); // Scale lightness to 0-127

  return packJagexHSL(packedHue, packedSaturation, packedLightness);
};

// Convert Jagex HSL to Hexadecimal color
export const convertJagexHSLToHex = (packedHsl) => {
  const { hue, saturation, lightness } = unpackJagexHSL(packedHsl);
  return convertHSLToHex(hue, saturation, lightness);
};

export const convertJagexHSLToHSL = (packedHsl) => {
  const { hue, saturation, lightness } = unpackJagexHSL(packedHsl);

  const normalizedHue = Math.round((hue / 63) * 360);
  const normalizedSaturation = Math.round((saturation / 7) * 100);
  const normalizedLightness = Math.round((lightness / 127) * 100);

  return { h: normalizedHue, s: normalizedSaturation, l: normalizedLightness }; // Return HSL values
};

export const getJagexHSLComponents = (packedHsl) => {
  const { hue, saturation, lightness } = unpackJagexHSL(packedHsl);

  return { hue, saturation, lightness }; // Return the raw HSL values
};


export const convertJagexHSLToRGB = (packedHsl) => {
  const hexColor = convertJagexHSLToHex(packedHsl);
  return convertHexToRGB(hexColor); // Convert the hex color to RGB
};

export const convertHexToRGB = (hex) => {
  // Remove the hash symbol if it's present
  const cleanedHex = hex.replace(/^#/, '');

  // Parse the R, G, B values from the hex string
  const r = parseInt(cleanedHex.slice(0, 2), 16);
  const g = parseInt(cleanedHex.slice(2, 4), 16);
  const b = parseInt(cleanedHex.slice(4, 6), 16);

  return { r, g, b }; // Return the RGB values as an object
};

// Helper function: Convert HSL (0-360, 0-100%, 0-100%) to Hexadecimal color
export const convertHSLToHex = (h, s, l) => {
  let hue = (h / 63) * 360; // Convert 6-bit hue to 0-360 degrees
  const saturation = (s / 7) * 100; // Convert 3-bit saturation to 0-100%
  const lightness = (l / 127) * 100; // Convert 7-bit lightness to 0-100%

  const chroma = (1 - Math.abs(2 * (lightness / 100) - 1)) * (saturation / 100);
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = lightness / 100 - chroma / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= hue && hue < 60) {
    r = chroma; g = x; b = 0;
  } else if (60 <= hue && hue < 120) {
    r = x; g = chroma; b = 0;
  } else if (120 <= hue && hue < 180) {
    r = 0; g = chroma; b = x;
  } else if (180 <= hue && hue < 240) {
    r = 0; g = x; b = chroma;
  } else if (240 <= hue && hue < 300) {
    r = x; g = 0; b = chroma;
  } else if (300 <= hue && hue < 360) {
    r = chroma; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  const toHex = (c) => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
