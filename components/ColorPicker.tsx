import React, {
    useState,
    useEffect,
    forwardRef,
    useImperativeHandle,
} from "react";
import { Label } from "@/components/ui/label";
import {
    convertHSLToHex as convertJagexHSLToHex,
    packJagexHSL as packHSL,
    unpackJagexHSL as unpackHSL
} from "@/components/ui/ColorUtils";
import { Slider } from "@/components/ui/slider";

interface HSL {
    hue: number;
    saturation: number;
    lightness: number;
}

interface ColorPickerProps {
    width?: number | string;  // allow string like "100%"
    defaultColor?: number;
    onChange?: (packedHSLJagex: number) => void;
}

export interface ColorPickerHandle {
    getPackedColor: () => number;
    handleHSLInputChange: (newHSL: number) => void;
}

const ColorPicker = forwardRef<ColorPickerHandle, ColorPickerProps>(
    ({ width = 300, defaultColor = 32191, onChange }, ref) => {
        const initialHSL: HSL = unpackHSL(defaultColor);

        const [hue, setHue] = useState<number>(initialHSL.hue);
        const [saturation, setSaturation] = useState<number>(initialHSL.saturation);
        const [lightness, setLightness] = useState<number>(initialHSL.lightness);
        const [selectedColor, setSelectedColor] = useState<string>(
            convertJagexHSLToHex(initialHSL.hue, initialHSL.saturation, initialHSL.lightness)
        );
        const [selectedColorString, setSelectedColorString] = useState<number>(defaultColor);

        const handleHSLInputChange = (newHSLValue: number) => {
            const unpackedHSL = unpackHSL(newHSLValue);

            setHue(unpackedHSL.hue);
            setSaturation(unpackedHSL.saturation);
            setLightness(unpackedHSL.lightness);

            setSelectedColorString(newHSLValue);

            const hexColor = convertJagexHSLToHex(
                unpackedHSL.hue,
                unpackedHSL.saturation,
                unpackedHSL.lightness
            );
            setSelectedColor(hexColor);
        };

        useEffect(() => {
            const hexColor = convertJagexHSLToHex(hue, saturation, lightness);
            const packedHSLJagex = packHSL(hue, saturation, lightness);

            setSelectedColor(hexColor);
            setSelectedColorString(packedHSLJagex);

            if (onChange) {
                onChange(packedHSLJagex);
            }
        }, [hue, saturation, lightness, onChange]);

        useImperativeHandle(ref, () => ({
            getPackedColor: () => selectedColorString,
            handleHSLInputChange: (newHSL: number) => {
                handleHSLInputChange(newHSL);
            },
        }));

        // Helper to build gradient background for sliders
        const buildGradient = (stops: string[]) => {
            return { background: `linear-gradient(to right, ${stops.join(", ")})` };
        };

        return (
            <div
                className="rounded-lg border border-gray-200 shadow-sm p-4"
                style={{
                    width: "100%",
                    maxWidth: typeof width === "number" ? `${width}px` : width,
                }}
            >
                <div
                    className="rounded-md flex items-center justify-center h-24 w-full mb-6"
                    style={{ backgroundColor: selectedColor }}
                >
                    <p
                        className={`font-semibold text-lg select-none ${
                            lightness > 35 ? "text-gray-900" : "text-white"
                        }`}
                    >
                        {selectedColorString}
                    </p>
                </div>

                <div className="space-y-6">
                    <div>
                        <Label htmlFor="hue-slider" className="mb-2 block text-sm font-medium">
                            Hue
                        </Label>
                        <Slider
                            id="hue-slider"
                            max={63}
                            value={[hue]}
                            onValueChange={(value) => setHue(value[0])}
                            style={buildGradient(
                                Array.from({ length: 64 }, (_, i) => `hsl(${i * (360 / 63)}, 100%, 50%)`)
                            )}
                        />
                    </div>

                    <div>
                        <Label htmlFor="saturation-slider" className="mb-2 block text-sm font-medium">
                            Saturation
                        </Label>
                        <Slider
                            id="saturation-slider"
                            max={7}
                            value={[saturation]}
                            onValueChange={(value) => setSaturation(value[0])}
                            style={buildGradient(
                                Array.from(
                                    { length: 8 },
                                    (_, i) => `hsl(${hue * (360 / 63)}, ${i * (100 / 7)}%, 50%)`
                                )
                            )}
                        />
                    </div>

                    <div>
                        <Label htmlFor="lightness-slider" className="mb-2 block text-sm font-medium">
                            Lightness
                        </Label>
                        <Slider
                            id="lightness-slider"
                            max={127}
                            value={[lightness]}
                            onValueChange={(value) => setLightness(value[0])}
                            style={buildGradient(
                                Array.from(
                                    { length: 128 },
                                    (_, i) => `hsl(${hue * (360 / 63)}, 50%, ${i * (100 / 127)}%)`
                                )
                            )}
                        />
                    </div>
                </div>
            </div>
        );
    }
);

ColorPicker.displayName = "ColorPicker";

export default ColorPicker;
