"use client";

import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { jagexHslToHex, jagexHslToRgb, jagexHslToStandardHsl } from "@/lib/jagex-color";

type RsColorBoxProps = {
  /** Jagex packed HSL (0–65535). Mutually exclusive with `rgb24`. */
  packedHsl?: number;
  /** 24-bit RGB integer (e.g. 11116512 → 0xA9DC20). Mutually exclusive with `packedHsl`. */
  rgb24?: number;
  width?: number;
  height?: number;
  showHex?: boolean;
  className?: string;
};

function getAccessibleTextColor(r: number, g: number, b: number): string {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

function rgb24ToHex(value: number): string {
  return `#${(value >>> 0).toString(16).padStart(6, "0")}`;
}

function rgb24ToComponents(value: number): { r: number; g: number; b: number } {
  const v = value >>> 0;
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}

export function RsColorBox({
  packedHsl,
  rgb24,
  width = 48,
  height = 48,
  showHex = false,
  className,
}: RsColorBoxProps) {
  const isRgb = rgb24 !== undefined;

  const hex = isRgb ? rgb24ToHex(rgb24!) : jagexHslToHex(packedHsl ?? 0);
  const rgb = isRgb ? rgb24ToComponents(rgb24!) : jagexHslToRgb(packedHsl ?? 0);
  const hsl = isRgb ? null : jagexHslToStandardHsl(packedHsl ?? 0);
  const textColor = getAccessibleTextColor(rgb.r, rgb.g, rgb.b);

  const tooltipText = isRgb
    ? `RGB: ${rgb24}\nHEX: ${hex}\nComponents: ${rgb.r}, ${rgb.g}, ${rgb.b}`
    : `Jagex HSL: ${packedHsl}\nHEX: ${hex}\nRGB: ${rgb.r}, ${rgb.g}, ${rgb.b}\nHSL: ${hsl!.h}, ${hsl!.s}%, ${hsl!.l}%`;

  const copyValue = isRgb ? String(rgb24) : String(packedHsl);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyValue);
    } catch {
      // Clipboard failures are non-fatal.
    }
  }, [copyValue]);

  return (
    <Tooltip>
      <TooltipTrigger
        onClick={handleCopy}
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-md border border-border font-mono text-[11px] font-semibold text-white shadow-sm",
          "cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.99]",
          className,
        )}
        style={{
          backgroundColor: hex,
          color: textColor,
          width: `${width}px`,
          height: `${height}px`,
          textShadow:
            textColor === "#ffffff"
              ? "0 1px 2px rgba(0,0,0,0.55)"
              : "0 1px 2px rgba(255,255,255,0.4)",
        }}
        aria-label={`${hex.toUpperCase()} color ${copyValue}`}
      >
        {showHex ? hex.toUpperCase() : null}
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line">{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
