import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { convertHSLToHex, unpackJagexHSL } from './ColorUtils';

interface ColorBoxProps {
    width?: number;
    height?: number;
    packedHsl?: number;
    tooltip?: boolean;
    showHex?: boolean;
}

const RSColorBox: React.FC<ColorBoxProps> = ({
                                               width = 100,
                                               height = 100,
                                               packedHsl = 0,
                                               tooltip = false,
                                               showHex = false,
                                           }) => {
    const { hue, saturation, lightness } = unpackJagexHSL(packedHsl);
    const hslColor = convertHSLToHex(hue, saturation, lightness);

    const tooltipContent = `HSL: (${hue}, ${saturation}%, ${lightness}%)\nHEX: ${hslColor}\nJagex HSL: ${packedHsl}`;

    const box = (
        <div
            className="flex items-center justify-center border border-black font-mono text-white text-xs shadow-sm"
            style={{
                backgroundColor: hslColor,
                width: `${width}px`,
                height: `${height}px`,
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            }}
        >
            {showHex && hslColor}
        </div>
    );

    return tooltip ? (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>{box}</TooltipTrigger>
                <TooltipContent className="whitespace-pre-line">{tooltipContent}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    ) : (
        box
    );
};

export default RSColorBox;
