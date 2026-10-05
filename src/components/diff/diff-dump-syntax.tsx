"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** High-contrast search hit paint. */
export const SEARCH_HIT_MARK_CLASS =
  "rounded-[2px] px-0.5 font-mono text-xs font-normal not-italic ring-1 ring-yellow-700/70 bg-yellow-300 text-neutral-950 dark:bg-amber-400 dark:text-neutral-950 dark:ring-amber-600/80";

type HighlightSeg = { text: string; highlight: boolean };

export function splitHighlightLiteral(text: string, needleRaw: string): HighlightSeg[] {
  const needle = needleRaw.trim();
  if (!needle) return [{ text, highlight: false }];
  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const out: HighlightSeg[] = [];
  let pos = 0;
  while (pos < text.length) {
    const idx = lowerText.indexOf(lowerNeedle, pos);
    if (idx === -1) {
      out.push({ text: text.slice(pos), highlight: false });
      break;
    }
    if (idx > pos) out.push({ text: text.slice(pos, idx), highlight: false });
    out.push({ text: text.slice(idx, idx + needle.length), highlight: true });
    pos = idx + needle.length;
  }
  return out;
}

export function SearchHitHighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text || " "}</>;
  const segs = splitHighlightLiteral(text || " ", q);
  return (
    <>
      {segs.map((seg, i) =>
        seg.highlight ? (
          <span key={i} className={SEARCH_HIT_MARK_CLASS} data-search-hit>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

function Hit({ text, query, className }: { text: string; query: string; className?: string }) {
  return (
    <span className={className}>
      <SearchHitHighlightedText text={text} query={query} />
    </span>
  );
}

/**
 * Dump-format syntax: pink keys, teal values, blue [headers], muted comments.
 * Matches the OpenRune reference codeview look.
 */
export function DumpSyntaxText({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const raw = text || " ";
  const trimmed = raw.trim();

  if (trimmed.startsWith("//")) {
    return <Hit text={raw} query={query} className={cn("text-zinc-500 dark:text-zinc-500", className)} />;
  }

  if (/^\[[^\]]+]$/.test(trimmed)) {
    // Section titles keep syntax color only — no search-hit paint.
    return (
      <span className={cn("font-medium text-sky-500 dark:text-sky-400", className)}>{raw || " "}</span>
    );
  }

  const eq = raw.indexOf("=");
  if (eq <= 0) {
    return <Hit text={raw} query={query} className={cn("text-foreground/90", className)} />;
  }

  const key = raw.slice(0, eq);
  const value = raw.slice(eq + 1);

  return (
    <span className={className}>
      <Hit text={key} query={query} className="text-fuchsia-600 dark:text-fuchsia-400" />
      <span className="text-zinc-400 dark:text-zinc-300">=</span>
      <DumpValueText value={value} query={query} />
    </span>
  );
}

function DumpValueText({ value, query }: { value: string; query: string }) {
  if (!value) return null;

  // `65,Vorkath` / `id,Description…`
  const comma = value.indexOf(",");
  if (comma > 0) {
    const left = value.slice(0, comma);
    const right = value.slice(comma);
    const leftIsNum = /^-?\d+(\.\d+)?$/.test(left.trim());
    return (
      <>
        <Hit
          text={left}
          query={query}
          className={leftIsNum ? "text-emerald-600 dark:text-emerald-300" : "text-teal-600 dark:text-teal-300"}
        />
        <Hit text={right} query={query} className="text-emerald-700 dark:text-emerald-400/90" />
      </>
    );
  }

  if (/^-?\d+(\.\d+)?$/.test(value.trim())) {
    return <Hit text={value} query={query} className="text-emerald-600 dark:text-emerald-300" />;
  }

  if (/^(true|false|yes|no)$/i.test(value.trim())) {
    return <Hit text={value} query={query} className="text-amber-600 dark:text-amber-300" />;
  }

  return <Hit text={value} query={query} className="text-teal-600 dark:text-teal-300" />;
}

export function sectionTitleFromBracket(line: string): string {
  const t = line.trim();
  if (t.startsWith("[") && t.endsWith("]") && t.length > 2) return t.slice(1, -1);
  return t;
}
