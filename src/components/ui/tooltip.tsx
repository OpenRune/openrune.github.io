"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

function TooltipProvider({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

/** Solid fill — inline so nothing from layers below shows through. */
const TOOLTIP_SOLID_BG = "rgb(9, 9, 11)"; // zinc-950

/**
 * Stacking: above dialogs (often z-50), drawers, and diff sticky controls (z-[60]–z-[100]).
 * Keep below `2147483647` to stay within common browser limits.
 */
const TOOLTIP_Z = "z-[200000]";

const tooltipPopupClassName =
  "pointer-events-auto flex w-fit max-w-sm flex-col gap-1.5 rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-50 shadow-2xl outline-none";

type TooltipContentProps = TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> & {
    /**
     * @deprecated All tooltips use a solid panel now; kept for call-site compatibility.
     */
    opaque?: boolean;
    hideArrow?: boolean;
  };

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  opaque: _opaque,
  hideArrow = false,
  style,
  ...props
}: TooltipContentProps) {
  const showArrow = !hideArrow;

  const popupStyle = React.useMemo(() => {
    const base: React.CSSProperties = {
      opacity: 1,
      backgroundColor: TOOLTIP_SOLID_BG,
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
      isolation: "isolate",
      transform: "translateZ(0)",
    };
    if (style && typeof style === "object" && !Array.isArray(style)) {
      return { ...base, ...style };
    }
    return base;
  }, [style]);

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={cn("pointer-events-none isolate", TOOLTIP_Z)}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(tooltipPopupClassName, className)}
          style={popupStyle}
          {...props}
        >
          {children}
          {showArrow ? (
            <TooltipPrimitive.Arrow className="z-10 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] border border-zinc-700 bg-zinc-950 fill-zinc-950 data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
          ) : null}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
