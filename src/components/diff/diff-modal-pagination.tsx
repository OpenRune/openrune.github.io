"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { MODAL_PAGE_SIZE } from "./diff-modal-paging";

export type ModalPaginationProps = {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
};

/** Compact prev/next bar for lists inside dialogs, where the full table bar is too tall. */
export function ModalPagination({ page, totalPages, totalCount, onPageChange }: ModalPaginationProps) {
  const first = (page - 1) * MODAL_PAGE_SIZE + 1;
  const last = Math.min(page * MODAL_PAGE_SIZE, totalCount);

  return (
    <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {first}–{last} of {totalCount}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 rounded-none p-0"
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" aria-hidden />
        </Button>
        <span className="px-1 font-mono text-xs tabular-nums text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 rounded-none p-0"
          disabled={page >= totalPages}
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
