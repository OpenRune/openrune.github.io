"use client";

export type PageItem = number | "ellipsis";

export function buildPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  let start = Math.max(2, currentPage - 2);
  let end = Math.min(totalPages - 1, currentPage + 2);
  const windowSize = 5;

  while (end - start + 1 < windowSize) {
    if (start > 2) {
      start -= 1;
    } else if (end < totalPages - 1) {
      end += 1;
    } else {
      break;
    }
  }

  if (start <= 2) {
    const shift = 3 - start;
    start += shift;
    end = Math.min(totalPages - 2, end + shift);
  }
  if (end >= totalPages - 1) {
    const shift = end - (totalPages - 2);
    end -= shift;
    start = Math.max(3, start - shift);
  }

  const items: PageItem[] = [1, "ellipsis"];
  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }
  items.push("ellipsis", totalPages);
  return items;
}
