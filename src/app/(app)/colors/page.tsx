"use client";

import * as React from "react";

import { RsColorBox } from "@/components/ui/rs-color-box";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  clampPackedHsl,
  hexToJagexHsl,
  jagexHslToHex,
  jagexHslToRgb,
  jagexHslToStandardHsl,
  packJagexHsl,
  unpackJagexHsl,
} from "@/lib/jagex-color";

function normalizeHex(value: string): string {
  const raw = value.trim().replace(/^#/, "").slice(0, 6);
  const hex = raw.replace(/[^0-9a-fA-F]/g, "");
  if (hex.length === 6) return `#${hex.toLowerCase()}`;
  return "#ffffff";
}

export default function ColorsPage() {
  const [packedHsl, setPackedHsl] = React.useState(32191);
  const [hex, setHex] = React.useState(jagexHslToHex(32191));

  const components = React.useMemo(() => unpackJagexHsl(packedHsl), [packedHsl]);
  const rgb = React.useMemo(() => jagexHslToRgb(packedHsl), [packedHsl]);
  const hsl = React.useMemo(() => jagexHslToStandardHsl(packedHsl), [packedHsl]);
  const normalHex = React.useMemo(() => jagexHslToHex(packedHsl), [packedHsl]);

  const updateFromPacked = React.useCallback((nextValue: number) => {
    const nextPacked = clampPackedHsl(nextValue);
    setPackedHsl(nextPacked);
    setHex(jagexHslToHex(nextPacked));
  }, []);

  const updateFromHex = React.useCallback((nextHex: string) => {
    const safeHex = normalizeHex(nextHex);
    const nextPacked = hexToJagexHsl(safeHex);
    setHex(safeHex);
    setPackedHsl(nextPacked);
  }, []);

  const updateComponent = React.useCallback(
    (key: "hue" | "saturation" | "lightness", value: number) => {
      const next = { ...components, [key]: value };
      updateFromPacked(packJagexHsl(next.hue, next.saturation, next.lightness));
    },
    [components, updateFromPacked],
  );

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 lg:grid-cols-4">
      <div className="space-y-6 lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Color Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="packed-hsl" className="text-sm">
                Jagex HSL (0-65535)
              </Label>
              <Input
                id="packed-hsl"
                type="number"
                min={0}
                max={65535}
                value={packedHsl}
                onChange={(event) => updateFromPacked(Number(event.currentTarget.value))}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="hex-value" className="text-sm">
                  RGB Color Picker
                </Label>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-border text-xs text-muted-foreground">
                      ?
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    Pick a standard RGB hex color, which will be approximated to Jagex&apos;s
                    16-bit HSL format.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="hex-value"
                type="text"
                value={hex}
                onChange={(event) => updateFromHex(event.currentTarget.value)}
                className="rounded-lg font-mono"
              />
              <input
                type="color"
                id="hex-color-picker"
                value={hex}
                onChange={(event) => updateFromHex(event.currentTarget.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-border bg-transparent p-1"
                aria-label="RGB color picker"
              />
            </div>

            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">Jagex HSL (packed):</span> {packedHsl}
              </p>
              <p>
                <span className="font-medium">Jagex HSL Components:</span> hsl({components.hue},{" "}
                {components.saturation}%, {components.lightness}%)
              </p>
              <p>
                <span className="font-medium">Saturation Bits:</span> 3 bits
              </p>
              <p>
                <span className="font-medium">Hue Bits:</span> 6 bits
              </p>
              <p>
                <span className="font-medium">Lightness Bits:</span> 7 bits
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Color Details
              <Badge variant="secondary">Info</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Jagex uses a 16-bit HSL color format in the engine, limiting available
              colors to 65,535 distinct values.
            </p>
            <p>
              Standard RGB pickers support 16.7 million colors. Selected RGB values can
              be approximated when converted to Jagex packed HSL.
            </p>
            <p>
              This helper uses Jagex&apos;s packed layout directly: 6 bits for hue, 3 bits for
              saturation, and 7 bits for lightness.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle>RSColor Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <RsColorBox packedHsl={packedHsl} width={144} height={96} showHex />
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Packed:</span> {packedHsl}
                </p>
                <p>
                  <span className="font-medium">RGB:</span> {rgb.r}, {rgb.g}, {rgb.b}
                </p>
                <p>
                  <span className="font-medium">HSL:</span> {hsl.h}, {hsl.s}%, {hsl.l}%
                </p>
                <p>
                  <span className="font-medium">Hex (resolved):</span> {normalHex}
                </p>
                <p>
                  <span className="font-medium">Jagex:</span> h{components.hue} s
                  {components.saturation} l{components.lightness}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Label htmlFor="hue-slider" className="font-medium">
                    Hue
                  </Label>
                  <span className="font-mono text-muted-foreground">{components.hue}</span>
                </div>
                <input
                  id="hue-slider"
                  type="range"
                  min={0}
                  max={63}
                  value={components.hue}
                  onChange={(event) => updateComponent("hue", Number(event.currentTarget.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Label htmlFor="sat-slider" className="font-medium">
                    Saturation
                  </Label>
                  <span className="font-mono text-muted-foreground">{components.saturation}</span>
                </div>
                <input
                  id="sat-slider"
                  type="range"
                  min={0}
                  max={7}
                  value={components.saturation}
                  onChange={(event) =>
                    updateComponent("saturation", Number(event.currentTarget.value))
                  }
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Label htmlFor="light-slider" className="font-medium">
                    Lightness
                  </Label>
                  <span className="font-mono text-muted-foreground">{components.lightness}</span>
                </div>
                <input
                  id="light-slider"
                  type="range"
                  min={0}
                  max={127}
                  value={components.lightness}
                  onChange={(event) =>
                    updateComponent("lightness", Number(event.currentTarget.value))
                  }
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
