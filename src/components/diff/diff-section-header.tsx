"use client";

import * as React from "react";
import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { DIFF_TABLE_SEARCH_TOOLTIP_CONTENT_CLASS } from "./diff-search-modes";

export type DiffSectionHeaderProps = {
  title: React.ReactNode;
  tooltipContent: React.ReactNode;
  /** Shown after the info control, e.g. `· 12 configs` (include leading punctuation if desired). */
  countLabel?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
};

export function DiffSectionHeader({ title, tooltipContent, countLabel, trailing, className }: DiffSectionHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-2", className)}>
      <h2 className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-semibold">
        {title}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              type="button"
              className="p-0.5 align-middle text-muted-foreground hover:text-primary focus:outline-none"
              aria-label="Section help"
            >
              <Info className="h-4 w-4" aria-hidden />
            </TooltipTrigger>
            <TooltipContent opaque className={DIFF_TABLE_SEARCH_TOOLTIP_CONTENT_CLASS}>
              {tooltipContent}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {countLabel != null ? <span className="text-sm font-normal text-muted-foreground">{countLabel}</span> : null}
      </h2>
      {trailing}
    </div>
  );
}
