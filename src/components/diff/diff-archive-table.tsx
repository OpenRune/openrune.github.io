"use client";

import * as React from "react";

import { Table } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { DIFF_ARCHIVE_TABLE_CLASS, DIFF_ARCHIVE_TABLE_SCROLL_CLASS } from "./diff-table-archive-styles";

export type DiffArchiveTableProps = Omit<React.ComponentProps<"div">, "children"> & {
  children: React.ReactNode;
  tableClassName?: string;
};

/** Scroll shell + `table-fixed` archive-style table (no column vertical borders). */
export function DiffArchiveTable({ children, className, tableClassName, ...props }: DiffArchiveTableProps) {
  return (
    <div className={cn(DIFF_ARCHIVE_TABLE_SCROLL_CLASS, className)} {...props}>
      <Table className={cn(DIFF_ARCHIVE_TABLE_CLASS, tableClassName)}>{children}</Table>
    </div>
  );
}
