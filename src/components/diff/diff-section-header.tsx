"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { DIFF_TABLE_SEARCH_TOOLTIP_CONTENT_CLASS } from "./diff-search-modes";
import { useDiffViewerChromeSlot } from "./diff-viewer-chrome";

export type DiffSectionHeaderProps = {
  title: React.ReactNode;
  tooltipContent: React.ReactNode;
  /** Shown after the info control, e.g. `· 12 configs` (include leading punctuation if desired). */
  countLabel?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
};

function DiffSectionHeaderContent({
  title,
  tooltipContent,
  countLabel,
  trailing,
  className,
  titleClassName,
}: DiffSectionHeaderProps & { titleClassName?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <h2 className={cn("flex min-w-0 flex-wrap items-center gap-2 font-semibold", titleClassName)}>
        {title}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              type="button"
              className="p-0.5 align-middle text-muted-foreground hover:text-primary focus:outline-none"
              aria-label="Section help"
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </TooltipTrigger>
            <TooltipContent opaque className={DIFF_TABLE_SEARCH_TOOLTIP_CONTENT_CLASS}>
              {tooltipContent}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {countLabel != null ? <span className="text-xs font-normal text-muted-foreground">{countLabel}</span> : null}
      </h2>
      {trailing}
    </div>
  );
}

export function DiffSectionHeader({ title, tooltipContent, countLabel, trailing, className }: DiffSectionHeaderProps) {
  const slot = useDiffViewerChromeSlot();

  if (slot) {
    if (!slot.slotEl) return null;
    return createPortal(
      <DiffSectionHeaderContent
        title={title}
        tooltipContent={tooltipContent}
        countLabel={countLabel}
        trailing={trailing}
        titleClassName="text-sm tracking-tight"
      />,
      slot.slotEl,
    );
  }

  return (
    <DiffSectionHeaderContent
      title={title}
      tooltipContent={tooltipContent}
      countLabel={countLabel}
      trailing={trailing}
      className={cn("mb-4", className)}
      titleClassName="text-lg"
    />
  );
}
