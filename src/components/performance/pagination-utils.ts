"use client";

export type PageItem = number | "ellipsis";

export function buildPageItems(currentPage: number, totalPages: number): PageItem[] {
  const safeTotal = Math.max(1, totalPages);
  const safeCurrent = Math.min(Math.max(1, currentPage), safeTotal);

  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1);
  }

  let start = Math.max(2, safeCurrent - 2);
  let end = Math.min(safeTotal - 1, safeCurrent + 2);
  const windowSize = 5;

  while (end - start + 1 < windowSize) {
    if (start > 2) {
      start -= 1;
      continue;
    }
    if (end < safeTotal - 1) {
      end += 1;
      continue;
    }
    break;
  }

  const items: PageItem[] = [1];
  if (start > 2) items.push("ellipsis");
  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }
  if (end < safeTotal - 1) items.push("ellipsis");
  items.push(safeTotal);
  return items;
}
