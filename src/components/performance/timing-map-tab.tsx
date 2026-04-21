"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerPageDropdown } from "@/components/ui/per-page-dropdown";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatNanosecondsToMs, formatNumber } from "@/lib/formatting";
import type { ProcessedFrame } from "@/lib/types/performance";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OptionDropdown } from "@/components/ui/option-dropdown";
import { buildPageItems } from "@/components/performance/pagination-utils";

type TimingMapTabProps = {
  frames: ProcessedFrame[];
  timingKeys: string[];
  selectedTiming?: string;
  onSelectedTimingChange?: (value: string) => void;
  hideTimingSelector?: boolean;
  page?: number;
  pageSize?: (typeof PAGE_SIZE_OPTIONS)[number];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: (typeof PAGE_SIZE_OPTIONS)[number]) => void;
  hidePaginationUI?: boolean;
};

const PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

export function TimingMapTab({
  frames,
  timingKeys,
  selectedTiming,
  onSelectedTimingChange,
  hideTimingSelector = false,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  hidePaginationUI = false,
}: TimingMapTabProps) {
  const [internalSelectedTiming, setInternalSelectedTiming] = React.useState<string>("all");
  const [internalPage, setInternalPage] = React.useState(1);
  const [internalPageSize, setInternalPageSize] = React.useState<(typeof PAGE_SIZE_OPTIONS)[number]>(PAGE_SIZE);

  const activeSelectedTiming = selectedTiming ?? internalSelectedTiming;
  const activePage = page ?? internalPage;
  const activePageSize = pageSize ?? internalPageSize;
  const isTimingControlled = selectedTiming !== undefined;
  const isPageControlled = page !== undefined;
  const isPageSizeControlled = pageSize !== undefined;

  const setSelectedTimingValue = (value: string) => {
    if (isTimingControlled) {
      onSelectedTimingChange?.(value);
      return;
    }
    setInternalSelectedTiming(value);
  };

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
    if (!isTimingControlled && activeSelectedTiming !== "all" && !timingKeys.includes(activeSelectedTiming)) {
      setSelectedTimingValue("all");
    }
  }, [activeSelectedTiming, isTimingControlled, timingKeys]);

  React.useEffect(() => {
    if (!isPageControlled) {
      setInternalPage(1);
    }
  }, [activeSelectedTiming, timingKeys, isPageControlled]);

  React.useEffect(() => {
    if (!isPageControlled) {
      setInternalPage(1);
    }
  }, [activePageSize, isPageControlled]);

  if (frames.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No timing data available.
        </CardContent>
      </Card>
    );
  }

  const timingData = frames.map((frame, index) => ({
    frame: index + 1,
    value: frame.timingMap[activeSelectedTiming] ?? 0,
  }));

  const values =
    activeSelectedTiming === "all"
      ? []
      : frames
          .map((frame) => frame.timingMap[activeSelectedTiming])
          .filter((value): value is number => typeof value === "number");

  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;
  const totalPages = Math.max(1, Math.ceil(frames.length / activePageSize));
  const safePage = Math.min(Math.max(activePage, 1), totalPages);
  const startIndex = (safePage - 1) * activePageSize;
  const visibleFrames =
    activeSelectedTiming === "all"
      ? frames
          .slice(startIndex, startIndex + activePageSize)
          .map((frame, index) => ({ frame, frameIndex: startIndex + index }))
      : frames.map((frame, index) => ({ frame, frameIndex: index }));
  const pageItems = buildPageItems(safePage, totalPages);
  const timingOptions = React.useMemo(
    () => [
      { value: "all", label: "All timings" },
      ...timingKeys.map((key) => ({ value: key, label: key })),
    ],
    [timingKeys],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 pt-2">
      {!hideTimingSelector ? (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">
            Timing
          </label>
          <OptionDropdown
            value={activeSelectedTiming}
            options={timingOptions}
            onChange={setSelectedTimingValue}
            className="w-[22rem]"
            buttonClassName="h-9 text-sm"
            ariaLabel="Select timing key"
          />
        </div>
      ) : null}

      {activeSelectedTiming === "all" ? (
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle className="text-base">All Timing Keys</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
              <Table className="table-fixed text-xs [&_tbody_td+td]:border-l [&_tbody_td+td]:border-muted [&_thead_th+th]:border-l [&_thead_th+th]:border-muted">
                <TableHeader className="sticky top-0 z-10 bg-muted/95 text-muted-foreground backdrop-blur-xs">
                  <TableRow>
                    <TableHead className="w-56 p-2 text-left font-medium">Timing</TableHead>
                    {visibleFrames.map(({ frameIndex }) => (
                      <TableHead key={frameIndex} className="p-2 text-right font-medium">
                        F{frameIndex + 1}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timingKeys.map((key) => (
                    <TableRow key={key} className="border-t align-top hover:bg-muted/35">
                      <TableCell className="truncate p-2 font-medium" title={key}>{key}</TableCell>
                      {visibleFrames.map(({ frame, frameIndex }) => (
                        <TableCell key={`${key}-${frameIndex}`} className="p-2 text-right font-mono">
                          {typeof frame.timingMap[key] === "number" ? formatNanosecondsToMs(frame.timingMap[key]) : "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!hidePaginationUI ? (
              <div className="mt-3 flex shrink-0 items-center gap-3">
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
                  Showing {formatNumber(visibleFrames.length)} of {formatNumber(frames.length)} columns
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
                          className="h-8 min-w-8 px-2"
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
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm">Average</CardTitle></CardHeader>
              <CardContent className="font-medium">{formatNanosecondsToMs(average)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Max</CardTitle></CardHeader>
              <CardContent className="font-medium">{formatNanosecondsToMs(max)}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Min</CardTitle></CardHeader>
              <CardContent className="font-medium">{formatNanosecondsToMs(min)}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{activeSelectedTiming} Over Frames</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timingData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="frame" />
                    <YAxis />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || payload.length === 0) return null;
                        const first = payload[0];
                        return (
                          <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
                            <div className="font-medium">Frame {String(label ?? "")}</div>
                            <div className="text-muted-foreground">
                              {activeSelectedTiming}:{" "}
                              {typeof first?.value === "number"
                                ? formatNanosecondsToMs(first.value)
                                : String(first?.value ?? "")}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
