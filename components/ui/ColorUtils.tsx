// Pack HSL values into the custom Jagex 16-bit HSL format
export const packJagexHSL = (hue: number, saturation: number, lightness: number): number => {
    // 6 bits for hue, 3 bits for saturation, 7 bits for lightness
    return (hue << (3 + 7)) | (saturation << 7) | lightness;
};

// Unpack the 16-bit Jagex HSL value into its components
export const unpackJagexHSL = (packedValue: number): { hue: number; saturation: number; lightness: number } => {
    const lightness = packedValue & 0b1111111; // 7 bits
    const saturation = (packedValue >> 7) & 0b111; // 3 bits
    const hue = (packedValue >> 10) & 0b111111; // 6 bits
    return { hue, saturation, lightness };
};

// Convert RGB to HSL (standard format)
export const rgbToHsl = (r: number, g: number, b: number): { hue: number; saturation: number; lightness: number } => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h: number = 0, s: number = 0;
    const l: number = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return {
        hue: Math.round(h * 360),
        saturation: Math.round(s * 100),
        lightness: Math.round(l * 100),
    };
};

// Convert hex to packed Jagex HSL
export const convertHexToJagexHSL = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return convertRgbToJagexHSL(r, g, b);
};

export const convertRgbToJagexHSL = (r: number, g: number, b: number): number => {
    const { hue, saturation, lightness } = rgbToHsl(r, g, b);
    const packedHue = Math.round((hue / 360) * 63); // 0–63
    const packedSaturation = Math.round((saturation / 100) * 7); // 0–7
    const packedLightness = Math.round((lightness / 100) * 127); // 0–127
    return packJagexHSL(packedHue, packedSaturation, packedLightness);
};

// Convert packed Jagex HSL to hex
export const convertJagexHSLToHex = (packedHsl: number): string => {
    const { hue, saturation, lightness } = unpackJagexHSL(packedHsl);
    return convertHSLToHex(hue, saturation, lightness);
};

// Convert packed Jagex HSL to normalized HSL
export const convertJagexHSLToHSL = (packedHsl: number): { h: number; s: number; l: number } => {
    const { hue, saturation, lightness } = unpackJagexHSL(packedHsl);
    return {
        h: Math.round((hue / 63) * 360),
        s: Math.round((saturation / 7) * 100),
        l: Math.round((lightness / 127) * 100),
    };
};

export const getJagexHSLComponents = (packedHsl: number): { hue: number; saturation: number; lightness: number } => {
    return unpackJagexHSL(packedHsl);
};

// Convert packed Jagex HSL to RGB
export const convertJagexHSLToRGB = (packedHsl: number): { r: number; g: number; b: number } => {
    const hex = convertJagexHSLToHex(packedHsl);
    return convertHexToRGB(hex);
};

// Convert hex to RGB
export const convertHexToRGB = (hex: string): { r: number; g: number; b: number } => {
    const cleaned = hex.replace(/^#/, '');
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b };
};

// Convert HSL (Jagex scale) to hex
export const convertHSLToHex = (h: number, s: number, l: number): string => {
    const hue = (h / 63) * 360;
    const saturation = (s / 7) * 100;
    const lightness = (l / 127) * 100;

    const chroma = (1 - Math.abs(2 * (lightness / 100) - 1)) * (saturation / 100);
    const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
    const m = lightness / 100 - chroma / 2;

    let r = 0, g = 0, b = 0;
    if (hue < 60) [r, g, b] = [chroma, x, 0];
    else if (hue < 120) [r, g, b] = [x, chroma, 0];
    else if (hue < 180) [r, g, b] = [0, chroma, x];
    else if (hue < 240) [r, g, b] = [0, x, chroma];
    else if (hue < 300) [r, g, b] = [x, 0, chroma];
    else [r, g, b] = [chroma, 0, x];

    const toHex = (v: number): string => {
        const hex = Math.round((v + m) * 255).toString(16).padStart(2, '0');
        return hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
