import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SearchTablePaginationProps {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  children?: React.ReactNode;
}

export const SearchTablePagination: React.FC<SearchTablePaginationProps> = ({
  page,
  setPage,
  totalPages,
  children,
}) => {
  let maxInBetween = 5;
  const pageButtons = [];
  pageButtons.push(
    <Button key={1} size="sm" variant={page === 1 ? "default" : "outline"} onClick={() => setPage(1)}>{1}</Button>
  );
  pageButtons.push(<span key="start-ellipsis" className="px-1">...</span>);
  let inBetweenStart = Math.max(2, Math.min(page - Math.floor(maxInBetween / 2), totalPages - maxInBetween));
  let inBetweenEnd = Math.min(totalPages - 1, inBetweenStart + maxInBetween - 1);
  if (inBetweenStart <= 2) {
    inBetweenStart = 2;
    inBetweenEnd = Math.min(totalPages - 1, inBetweenStart + maxInBetween - 1);
  }
  if (inBetweenEnd >= totalPages - 1) {
    inBetweenEnd = totalPages - 1;
    inBetweenStart = Math.max(2, inBetweenEnd - maxInBetween + 1);
  }
  for (let i = inBetweenStart; i <= inBetweenEnd; i++) {
    pageButtons.push(
      <Button
        key={i}
        size="sm"
        variant={page === i ? "default" : "outline"}
        onClick={() => setPage(i)}
      >
        {i}
      </Button>
    );
  }
  pageButtons.push(<span key="end-ellipsis" className="px-1">...</span>);
  if (totalPages > 1) {
    pageButtons.push(
      <Button key={totalPages} size="sm" variant={page === totalPages ? "default" : "outline"} onClick={() => setPage(totalPages)}>{totalPages}</Button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {children}
      <Button
        size="sm"
        onClick={() => setPage((p) => Math.max(p - 1, 1))}
        disabled={page === 1}
        className="flex items-center justify-center"
        variant="outline"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div className="hidden md:flex items-center gap-1">
        {pageButtons}
      </div>
      <div className="hidden sm:flex md:hidden items-center gap-1">
        <Button key={1} size="sm" variant={page === 1 ? "default" : "outline"} onClick={() => setPage(1)}>{1}</Button>
        {totalPages > 1 && (
          <Button key={totalPages} size="sm" variant={page === totalPages ? "default" : "outline"} onClick={() => setPage(totalPages)}>{totalPages}</Button>
        )}
      </div>
      <Input
        type="number"
        min={1}
        max={totalPages}
        value={page}
        onChange={(e) => {
          let val = Number(e.target.value);
          if (val < 1) val = 1;
          if (val > totalPages) val = totalPages;
          setPage(val);
        }}
        className="w-16 text-center"
      />
      <Button
        size="sm"
        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
        disabled={page === totalPages}
        className="flex items-center justify-center"
        variant="outline"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}; 