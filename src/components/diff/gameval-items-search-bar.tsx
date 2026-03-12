"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { GAMEVAL_MIN_REVISION } from "@/components/diff/diff-constants";
import { ITEMTYPES, useGamevals } from "@/context/gameval-context";
import { useSettings } from "@/context/settings-context";
import { cn } from "@/lib/utils";

type GamevalItemsSearchBarProps = {
  rev: number;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
};

export function GamevalItemsSearchBar({ rev, value, onValueChange, className }: GamevalItemsSearchBarProps) {
  const { settings } = useSettings();
  const { getGamevalEntries, hasLoaded, loadGamevalType, isLoading } = useGamevals();
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const supported = rev >= GAMEVAL_MIN_REVISION;
  const suggestionsEnabled = settings.suggestionDisplay.items;

  React.useEffect(() => {
    if (!supported || !suggestionsEnabled) return;
    void loadGamevalType(ITEMTYPES, rev);
  }, [rev, supported, suggestionsEnabled, loadGamevalType]);

  const suggestions = React.useMemo(() => {
    if (!supported || !suggestionsEnabled) return [];
    if (!hasLoaded(ITEMTYPES, rev)) return [];
    const q = value.trim().toLowerCase();
    if (q.length === 0) return [];
    const entries = getGamevalEntries(ITEMTYPES, rev) ?? [];
    return entries
      .filter((e) => e.lowerName.includes(q) || String(e.id).includes(q))
      .sort((a, b) => {
        const as = a.lowerName.startsWith(q) ? 0 : String(a.id).startsWith(q) ? 1 : 2;
        const bs = b.lowerName.startsWith(q) ? 0 : String(b.id).startsWith(q) ? 1 : 2;
        if (as !== bs) return as - bs;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 30);
  }, [supported, suggestionsEnabled, rev, value, getGamevalEntries, hasLoaded]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [value, suggestions.length]);

  const inputClass = "max-w-xl min-w-0 w-full flex-1";

  if (!supported) {
    return (
      <div className={cn("space-y-1", className)}>
        <Input
          className={inputClass}
          placeholder="Search lines…"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Item gameval suggestions need revision {GAMEVAL_MIN_REVISION}+ (current {rev}).
        </p>
      </div>
    );
  }

  if (!suggestionsEnabled) {
    return (
      <Input
        className={cn(inputClass, className)}
        placeholder="Search lines…"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      />
    );
  }

  const loading = isLoading(ITEMTYPES, rev);
  const loaded = hasLoaded(ITEMTYPES, rev);

  return (
    <div ref={rootRef} className={cn("relative min-w-0 flex-1", className)}>
      <Input
        className={inputClass}
        placeholder="Search lines or item gameval (suggestions)…"
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && value.trim() && !loaded && loading ? (
        <ul
          className="absolute top-full z-[60] mt-1 max-h-64 w-full min-w-[12rem] overflow-auto rounded-md border bg-popover py-2 text-sm text-muted-foreground shadow-md"
          role="listbox"
        >
          <li className="px-3 py-1.5">Loading item gamevals…</li>
        </ul>
      ) : null}
      {open && suggestions.length > 0 ? (
        <ul
          className="absolute top-full z-[60] mt-1 max-h-64 w-full min-w-[12rem] overflow-auto rounded-md border bg-popover py-1 shadow-md"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.id}-${s.name}`} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm",
                  i === activeIndex && "bg-muted",
                )}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onValueChange(s.name);
                  setOpen(false);
                }}
              >
                <span className="truncate font-mono text-xs">{s.name}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  id: {s.id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && value.trim() && loaded && suggestions.length === 0 ? (
        <ul className="absolute top-full z-[60] mt-1 w-full min-w-[12rem] rounded-md border bg-popover py-2 text-sm text-muted-foreground shadow-md">
          <li className="px-3 py-1.5">No matching item gamevals</li>
        </ul>
      ) : null}
    </div>
  );
}
