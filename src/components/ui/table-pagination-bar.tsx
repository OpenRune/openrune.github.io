"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PerPageDropdown } from "@/components/ui/per-page-dropdown";
import { buildPageItems } from "@/components/performance/pagination-utils";
import { formatNumber } from "@/lib/formatting";

export type TablePaginationBarProps = {
  /** Shown next to the per-page control (default: "Per page"). */
  perPageLabel?: string;
  pageSize: number;
  pageSizeOptions: readonly number[];
  onPageSizeChange: (value: number) => void;
  /** 1-based current page. */
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Items on this page (e.g. slice length). */
  showingCount: number;
  /** Total items across all pages. */
  totalCount: number;
  /** Noun for the center line, e.g. "rows" or "sprites". */
  countLabel?: string;
};

export function TablePaginationBar({
  perPageLabel = "Per page",
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  currentPage,
  totalPages,
  onPageChange,
  showingCount,
  totalCount,
  countLabel = "rows",
}: TablePaginationBarProps) {
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const pageItems = React.useMemo(() => buildPageItems(safePage, Math.max(1, totalPages)), [safePage, totalPages]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{perPageLabel}</span>
        <PerPageDropdown value={pageSize} options={pageSizeOptions} onChange={onPageSizeChange} />
      </div>
      <div className="flex-1 text-center text-xs text-muted-foreground">
        Showing {formatNumber(showingCount)} of {formatNumber(totalCount)} {countLabel}
        <span className="mx-2">|</span>
        Page {formatNumber(safePage)} / {formatNumber(Math.max(1, totalPages))}
      </div>
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-1">
        <Button
          size="icon-xs"
          variant="outline"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
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
                onClick={() => onPageChange(item)}
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
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          aria-label="Go to next page"
          title="Next page"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
