/**
 * Visual parity with the cache archive data table, without column vertical borders
 * (no td+td / th+th border-l utilities or per-cell border-x).
 */
export const DIFF_ARCHIVE_TABLE_SCROLL_CLASS = "min-h-0 flex-1 overflow-auto rounded-lg border";

export const DIFF_ARCHIVE_TABLE_CLASS = "w-full table-fixed text-xs";

export const DIFF_ARCHIVE_TABLE_HEADER_CLASS =
  "sticky top-0 z-10 bg-muted/95 text-muted-foreground backdrop-blur-xs";

/** Overrides default TableHead height so padding matches cache archive. */
export const DIFF_ARCHIVE_TABLE_HEAD_CLASS =
  "h-auto min-h-0 p-2 pr-3 text-left font-medium whitespace-nowrap";

export const DIFF_ARCHIVE_TABLE_CELL_CLASS = "p-2 align-top";

/** Body rows on cache archive (non-interactive variant). */
export const DIFF_ARCHIVE_TABLE_ROW_CLASS = "border-t align-top hover:bg-muted/35";

/** Combined sprite rows: archive hover + existing keyboard focus ring. */
export const DIFF_ARCHIVE_TABLE_ROW_INTERACTIVE_CLASS =
  "border-t align-top hover:bg-muted/35 focus-visible:bg-muted/35 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
