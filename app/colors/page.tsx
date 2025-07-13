"use client";

import React, { useState, useRef, useEffect, useCallback, startTransition } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
    convertHexToJagexHSL,
    convertJagexHSLToHex,
    convertJagexHSLToHSL,
    convertJagexHSLToRGB,
    getJagexHSLComponents,
} from "@/components/ui/ColorUtils";
import ColorPicker from "@/components/ColorPicker";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Simple debounce helper
const debounce = (fn: Function, delay: number) => {
    let timer: NodeJS.Timeout;
    return (...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
};

const Colors: React.FC = () => {
    const [hslValue, setJagexHslValue] = useState<number>(0);
    const [hexValue, setHexValue] = useState<string>("#ffffff");
    const colorPickerRef = useRef<{
        getPackedColor: () => number;
        handleHSLInputChange: (value: number) => void;
    } | null>(null);

    // Wrapped handleColorChange to debounce hex inputs
    const handleColorChange = (
        value: number | string,
        source: "hsl" | "hex" = "hsl"
    ) => {
        if (source === "hsl") {
            const numericValue = Number(value);
            startTransition(() => {
                setJagexHslValue(numericValue);
                const hexColor = convertJagexHSLToHex(numericValue);
                setHexValue(hexColor);

                if (
                    colorPickerRef.current &&
                    colorPickerRef.current.getPackedColor() !== numericValue
                ) {
                    colorPickerRef.current.handleHSLInputChange(numericValue);
                }
            });
        } else if (source === "hex") {
            const stringValue = String(value);
            startTransition(() => {
                setHexValue(stringValue);
                const packedHsl = convertHexToJagexHSL(stringValue);
                setJagexHslValue(packedHsl);

                if (
                    colorPickerRef.current &&
                    colorPickerRef.current.getPackedColor() !== packedHsl
                ) {
                    colorPickerRef.current.handleHSLInputChange(packedHsl);
                }
            });
        }
    };

    // Debounced version of handleColorChange for hex inputs (RGB color picker)
    // To avoid too many rapid updates when dragging
    const debouncedHandleHexChange = useCallback(
        debounce((value: string) => {
            handleColorChange(value, "hex");
        }, 150),
        []
    );

    // On mount, initialize color picker with current packed color
    useEffect(() => {
        if (colorPickerRef.current) {
            const color = colorPickerRef.current.getPackedColor() || 0;
            handleColorChange(color, "hsl");
        }
    }, []);

    const packedColor = colorPickerRef.current?.getPackedColor() ?? 0;

    const rgb = convertJagexHSLToRGB(packedColor);
    const normalHsl = convertJagexHSLToHSL(packedColor);
    const jagexHslComponents = getJagexHSLComponents(packedColor);
    const normalHex = convertJagexHSLToHex(packedColor);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 p-4">
            {/* Left column: Color Settings + Color Information */}
            <div className="md:col-span-1 flex flex-col space-y-6">
                <Card className="flex flex-col space-y-4">
                    <CardHeader>
                        <h2 className="text-lg font-semibold">Color Settings</h2>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="jagexHSL">Jagex HSL</Label>
                            <Input
                                type="number"
                                id="jagexHSL"
                                value={hslValue}
                                min={0}
                                max={65535}
                                placeholder="Enter Jagex HSL (0-65535)"
                                onChange={(e) => handleColorChange(e.currentTarget.value, "hsl")}
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label
                                htmlFor="rgbPicker"
                                className="mb-1 font-medium flex items-center gap-2"
                            >
                                RGB Color Picker
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Badge variant="outline" className="cursor-help text-xs">
                                            ?
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-xs">
                                        Pick a standard RGB hex color, which will be approximated to
                                        Jagex's 16-bit HSL format.
                                    </TooltipContent>
                                </Tooltip>
                            </Label>
                            <Input
                                type="color"
                                id="rgbPicker"
                                value={hexValue}
                                onChange={(e) => debouncedHandleHexChange(e.currentTarget.value)}
                                className="h-10 w-full cursor-pointer p-0 rounded-md"
                            />
                        </div>

                        <div className="space-y-2 mt-3 text-sm">
                            <p>
                                <span className="font-medium">Jagex HSL (packed):</span>{" "}
                                {packedColor}
                            </p>
                            <p>
                                <span className="font-medium">Jagex HSL Components:</span> hsl(
                                {jagexHslComponents.h}, {jagexHslComponents.s}%,{" "}
                                {jagexHslComponents.l}%)
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

                <Card className="space-y-3">
                    <CardHeader className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Color Details</h3>
                        <Badge variant="secondary" className="uppercase tracking-wider">
                            Info
                        </Badge>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                        <p>
                            Jagex uses a 16-bit HSL color format within their engine, limiting
                            them to 65,535 distinct colors.
                        </p>
                        <p>
                            RGB color pickers allow for 16.7 million colors. The color you
                            select may not exist within the 16-bit palette and will be
                            approximated, which can lead to slightly different results.
                        </p>
                        <p>
                            This tool generates a color palette using Jagex's 16-bit HSL
                            format: 6 bits for hue, 3 bits for saturation, and 7 bits for
                            lightness.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Right column: Color Picker + Color Details */}
            <div className="md:col-span-3 flex flex-col space-y-8">
                <Card>
                    <CardHeader>
                        <h2 className="text-lg font-semibold">Color Picker</h2>
                    </CardHeader>
                    <CardContent className="flex justify-center p-6">
                        <div className="w-full max-w-[600px]">
                            <ColorPicker
                                ref={colorPickerRef}
                                width={480}
                                onChange={(packedHSLJagex: number) => {
                                    handleColorChange(packedHSLJagex, "hsl");
                                }}
                                style={{ width: "100%", height: "auto" }}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Colors;
