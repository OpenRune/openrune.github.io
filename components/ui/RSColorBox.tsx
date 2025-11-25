import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { convertHSLToHex, unpackJagexHSL, convertJagexHSLToRGB, convertJagexHSLToHSL } from './ColorUtils';

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
    const rgb = convertJagexHSLToRGB(packedHsl);
    const hsl = convertJagexHSLToHSL(packedHsl);

    const tooltipContent = `HSL: (${hue}, ${saturation}%, ${lightness}%)\nHEX: ${hslColor}\nJagex HSL: ${packedHsl}`;

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const box = (
        <div
            className="flex items-center justify-center border border-black font-mono text-white text-xs shadow-sm cursor-pointer"
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

    // Create box with tooltip if enabled
    const boxWithTooltip = tooltip ? (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    {box}
                </TooltipTrigger>
                <TooltipContent className="whitespace-pre-line">{tooltipContent}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    ) : box;

    // Wrap with context menu
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {boxWithTooltip}
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onClick={() => copyToClipboard(String(packedHsl))}>
                    Copy Jagex Color
                    <span className="ml-auto text-xs text-muted-foreground font-mono">{packedHsl}</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => copyToClipboard(hslColor)}>
                    Copy Hex
                    <span className="ml-auto text-xs text-muted-foreground font-mono">{hslColor}</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => copyToClipboard(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`)}>
                    Copy RGB
                    <span className="ml-auto text-xs text-muted-foreground font-mono">rgb({rgb.r}, {rgb.g}, {rgb.b})</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => copyToClipboard(`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`)}>
                    Copy HSL
                    <span className="ml-auto text-xs text-muted-foreground font-mono">hsl({hsl.h}, {hsl.s}%, {hsl.l}%)</span>
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

export default RSColorBox;
