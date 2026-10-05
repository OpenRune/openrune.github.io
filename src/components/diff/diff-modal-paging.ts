"use client";

import * as React from "react";

/** Lists inside dialogs page above this length; short lists render whole. */
export const MODAL_PAGE_SIZE = 10;

export type ModalPaging<T> = {
  /** Rows for the current page (the whole list when it fits). */
  items: T[];
  page: number;
  totalPages: number;
  /** False when the list fits on one page and the bar should stay hidden. */
  paged: boolean;
  setPage: (page: number) => void;
};

/**
 * Page a modal list, resetting whenever [resetKey] changes (tab switch, new payload).
 * The page is clamped so removing entries can never strand the view past the end.
 */
export function useModalPaging<T>(items: T[], resetKey: string): ModalPaging<T> {
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / MODAL_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * MODAL_PAGE_SIZE;

  return {
    items: items.length > MODAL_PAGE_SIZE ? items.slice(start, start + MODAL_PAGE_SIZE) : items,
    page: safePage,
    totalPages,
    paged: items.length > MODAL_PAGE_SIZE,
    setPage,
  };
}
