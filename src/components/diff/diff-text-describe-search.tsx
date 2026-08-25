"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DESCRIBE_SEARCH_EXAMPLES, describeToQuery } from "./diff-describe-to-query";

export type TextDescribeSearchMode = "describe" | "text" | "regex" | "query";

type DiffTextDescribeSearchProps = {
  mode: TextDescribeSearchMode;
  onModeChange: (mode: TextDescribeSearchMode) => void;
  /** Draft natural-language text while in Describe mode. */
  describeValue: string;
  onDescribeChange: (value: string) => void;
  /** Active query used for matching (Query mode). */
  queryValue: string;
  onQueryChange: (value: string) => void;
  /** Optional scope for describe→query (config section id). */
  scopeHint?: string;
  matchIndex: number;
  matchCount: number;
  navDisabled: boolean;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  error?: string | null;
  className?: string;
};

export function DiffTextDescribeSearch({
  mode,
  onModeChange,
  describeValue,
  onDescribeChange,
  queryValue,
  onQueryChange,
  scopeHint,
  matchIndex,
  matchCount,
  navDisabled,
  onPrevMatch,
  onNextMatch,
  error,
  className,
}: DiffTextDescribeSearchProps) {
  const inputValue = mode === "describe" ? describeValue : queryValue;
  const placeholder =
    mode === "describe"
      ? "Describe what you want to find in ordinary language…"
      : "FROM items WHERE tradeable = no";

  const createSearch = React.useCallback(() => {
    const source = mode === "describe" ? describeValue : queryValue;
    const next = mode === "describe" ? describeToQuery(source, scopeHint) : source.trim();
    if (!next) return;
    onQueryChange(next);
    onModeChange("query");
  }, [describeValue, mode, onModeChange, onQueryChange, queryValue, scopeHint]);

  const applyExample = React.useCallback(
    (example: string) => {
      onDescribeChange(example);
      const next = describeToQuery(example, scopeHint);
      onQueryChange(next);
      onModeChange("query");
    },
    [onDescribeChange, onModeChange, onQueryChange, scopeHint],
  );

  return (
    <div className={cn("relative z-[70] flex min-w-0 max-w-full flex-initial flex-col gap-1.5", className)}>
      <div
        className={cn(
          "relative z-50 flex h-8 min-w-0 max-w-full flex-nowrap items-stretch rounded-md border border-border bg-muted/25 shadow-sm",
          "dark:bg-muted/20",
        )}
      >
        <div className="flex shrink-0 items-center gap-1 border-r border-border px-1.5 text-[11px] text-muted-foreground">
          <Search className="size-3.5 text-sky-500" aria-hidden />
          <span className="hidden font-medium sm:inline">Search</span>
        </div>

        <label className="flex shrink-0 items-center">
          <span className="sr-only">Search mode</span>
          <select
            value={mode}
            onChange={(e) => onModeChange(e.target.value as TextDescribeSearchMode)}
            className={cn(
              "h-full appearance-none border-0 bg-transparent py-0 pl-2 pr-6 text-xs font-medium text-foreground outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring/40",
            )}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.35rem center",
            }}
          >
            <option value="describe">Describe</option>
            <option value="text">Text</option>
            <option value="regex">Regex</option>
            <option value="query">Query</option>
          </select>
        </label>

        <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />

        <label className="flex min-h-0 min-w-0 flex-1 cursor-text items-center px-2">
          <span className="sr-only">{mode === "describe" ? "Describe search" : "Query search"}</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              if (mode === "describe") onDescribeChange(e.target.value);
              else onQueryChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (mode === "describe") {
                  createSearch();
                  return;
                }
                if (e.shiftKey) onPrevMatch();
                else onNextMatch();
              }
            }}
            placeholder={placeholder}
            aria-invalid={error != null}
            className={cn(
              "min-h-0 min-w-0 w-full bg-transparent py-1 text-xs text-foreground outline-none",
              mode === "query" ? "font-mono" : "font-sans",
              "placeholder:text-muted-foreground",
            )}
          />
        </label>

        <div className="flex shrink-0 items-center gap-1 border-l border-border px-1">
          <Button
            type="button"
            size="xs"
            className="h-6 bg-sky-600 px-2 text-[11px] text-white hover:bg-sky-500"
            onClick={createSearch}
            disabled={!(mode === "describe" ? describeValue : queryValue).trim()}
          >
            Create search
          </Button>
        </div>

        <div className="flex shrink-0 flex-nowrap items-stretch" aria-label="Match navigation">
          <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />
          <div className="flex h-full w-8 shrink-0 flex-col divide-y divide-border">
            <button
              type="button"
              title="Previous match (Shift+Enter)"
              aria-label="Previous match"
              disabled={navDisabled}
              className={cn(
                "flex min-h-0 flex-1 items-center justify-center border-0 bg-muted/50 text-foreground",
                "hover:bg-muted/80 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
              )}
              onClick={onPrevMatch}
            >
              <ChevronUp className="size-3 shrink-0 opacity-80" aria-hidden />
            </button>
            <button
              type="button"
              title="Next match (Enter)"
              aria-label="Next match"
              disabled={navDisabled}
              className={cn(
                "flex min-h-0 flex-1 items-center justify-center border-0 bg-muted/50 text-foreground",
                "hover:bg-muted/80 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
              )}
              onClick={onNextMatch}
            >
              <ChevronDown className="size-3 shrink-0 opacity-80" aria-hidden />
            </button>
          </div>
          <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />
          <div
            className={cn(
              "flex h-full min-w-[4.75rem] shrink-0 items-center justify-center bg-muted/50 px-1 text-[11px] leading-none tabular-nums text-muted-foreground",
              navDisabled && "opacity-40",
            )}
            aria-live="polite"
          >
            {matchCount > 0 ? `${matchIndex + 1}/${matchCount}` : "—"}
          </div>
        </div>
      </div>

      {mode === "describe" || !queryValue.trim() ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>Try describing</span>
          {DESCRIBE_SEARCH_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-md border border-border/80 bg-background/60 px-2 py-0.5 text-left text-[11px] text-foreground/90 transition-colors hover:bg-muted"
              onClick={() => applyExample(example)}
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
