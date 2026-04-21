"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerPageDropdown } from "@/components/ui/per-page-dropdown";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatMebibytes, formatNanosecondsToMs, formatNumber } from "@/lib/formatting";
import type { ProcessedFrame } from "@/lib/types/performance";
import { buildPageItems } from "@/components/performance/pagination-utils";

type FramesTabProps = {
  frames: ProcessedFrame[];
  page?: number;
  pageSize?: (typeof PAGE_SIZE_OPTIONS)[number];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: (typeof PAGE_SIZE_OPTIONS)[number]) => void;
  hidePaginationUI?: boolean;
};

const PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

export function FramesTab({
  frames,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  hidePaginationUI = false,
}: FramesTabProps) {
  const [collapsed, setCollapsed] = React.useState<Set<number>>(
    () => new Set(frames.map((_, index) => index)),
  );
  const [internalPage, setInternalPage] = React.useState(1);
  const [internalPageSize, setInternalPageSize] = React.useState<(typeof PAGE_SIZE_OPTIONS)[number]>(PAGE_SIZE);

  const activePage = page ?? internalPage;
  const activePageSize = pageSize ?? internalPageSize;
  const isPageControlled = page !== undefined;
  const isPageSizeControlled = pageSize !== undefined;

  const setPageValue = (next: number) => {
    if (isPageControlled) {
      onPageChange?.(next);
      return;
    }
    setInternalPage(next);
  };

  const setPageSizeValue = (next: (typeof PAGE_SIZE_OPTIONS)[number]) => {
    if (isPageSizeControlled) {
      onPageSizeChange?.(next);
      return;
    }
    setInternalPageSize(next);
  };

  React.useEffect(() => {
    setCollapsed(new Set(frames.map((_, index) => index)));
    if (!isPageControlled) {
      setInternalPage(1);
    }
  }, [frames, isPageControlled]);

  React.useEffect(() => {
    if (!isPageControlled) {
      setInternalPage(1);
    }
  }, [activePageSize, isPageControlled]);

  const toggleFrame = (index: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (frames.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No frame data available.
        </CardContent>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(frames.length / activePageSize));
  const safePage = Math.min(Math.max(activePage, 1), totalPages);
  const startIndex = (safePage - 1) * activePageSize;
  const visibleFrames = frames.slice(startIndex, startIndex + activePageSize);
  const pageItems = buildPageItems(safePage, totalPages);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden pt-2">
      <div className="flex gap-1.5">
        <Button size="xs" variant="outline" onClick={() => setCollapsed(new Set(frames.map((_, index) => index)))}>
          Collapse All
        </Button>
        <Button size="xs" variant="outline" onClick={() => setCollapsed(new Set())}>
          Expand All
        </Button>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardContent className="min-h-0 flex-1 pt-2">
          <div className="h-full space-y-2 overflow-auto pr-1">
            {visibleFrames.map((frame, index) => {
              const globalIndex = startIndex + index;
              const isCollapsed = collapsed.has(globalIndex);
              return (
                <Collapsible key={globalIndex} open={!isCollapsed} onOpenChange={() => toggleFrame(globalIndex)}>
                  <Card>
                    <CollapsibleTrigger className="w-full text-left">
                      <CardHeader className="cursor-pointer py-2 hover:bg-muted/40">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium">
                          {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                          Frame {globalIndex + 1}
                          <Badge variant={frame.bottleneck === "CPU" ? "destructive" : "default"}>
                            {frame.bottleneck}
                          </Badge>
                          <Badge variant="outline">{frame.estimatedFps.toFixed(1)} FPS</Badge>
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="grid gap-3 text-sm md:grid-cols-4">
                        <div><span className="text-muted-foreground">Elapsed</span><div>{frame.elapsedMs.toFixed(2)} ms</div></div>
                        <div><span className="text-muted-foreground">CPU</span><div>{formatNanosecondsToMs(frame.cpuTimeNs)}</div></div>
                        <div><span className="text-muted-foreground">GPU</span><div>{formatNanosecondsToMs(frame.gpuTimeNs)}</div></div>
                        <div><span className="text-muted-foreground">Memory</span><div>{formatMebibytes(frame.memoryUsed)}</div></div>
                        <div><span className="text-muted-foreground">Tiles</span><div>{frame.drawnTiles.toLocaleString("en-US")}</div></div>
                        <div><span className="text-muted-foreground">Static</span><div>{frame.drawnStatic.toLocaleString("en-US")}</div></div>
                        <div><span className="text-muted-foreground">Dynamic</span><div>{frame.drawnDynamic.toLocaleString("en-US")}</div></div>
                        <div><span className="text-muted-foreground">NPC Cache</span><div>{frame.npcDisplacementCacheSize.toLocaleString("en-US")}</div></div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {!hidePaginationUI ? (
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Per page
          </span>
          <PerPageDropdown
            value={activePageSize}
            options={PAGE_SIZE_OPTIONS}
            onChange={(value) => setPageSizeValue(value as (typeof PAGE_SIZE_OPTIONS)[number])}
          />
        </div>
        <div className="flex-1 text-center text-xs text-muted-foreground">
          Showing {formatNumber(visibleFrames.length)} of {formatNumber(frames.length)} rows
          <span className="mx-2">|</span>
          Page {formatNumber(safePage)} / {formatNumber(totalPages)}
        </div>
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-1">
          <Button
            size="icon-xs"
            variant="outline"
            disabled={safePage <= 1}
            onClick={() => setPageValue(Math.max(1, safePage - 1))}
            aria-label="Go to previous page"
            title="Previous page"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <div className="flex items-center gap-1">
            {pageItems.map((item, index) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={item}
                  size="sm"
                  variant={item === safePage ? "default" : "outline"}
                  className="h-7 min-w-7 px-2 text-xs"
                  onClick={() => setPageValue(item)}
                  aria-label={`Go to page ${item}`}
                >
                  {item}
                </Button>
              ),
            )}
          </div>
          <Button
            size="icon-xs"
            variant="outline"
            disabled={safePage >= totalPages}
            onClick={() => setPageValue(Math.min(totalPages, safePage + 1))}
            aria-label="Go to next page"
            title="Next page"
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
      ) : null}
    </div>
  );
}
