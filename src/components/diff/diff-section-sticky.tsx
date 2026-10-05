"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import type { ConfigLine } from "./diff-types";
import { sectionTitleFromBracket } from "./diff-dump-syntax";
import { sectionTitleMatchesFocus } from "./diff-focus-match";
import {
  DumpSectionTitleHover,
  type SectionTitleHoverInfo,
} from "./diff-section-title-tooltip";

export type SectionMeta = {
  start: number;
  end: number;
  title: string;
  /** Numeric id from the leading `// id` comment, when present. */
  entityId: number | null;
  added: number;
  removed: number;
};

export type TextViewRow =
  | { kind: "header"; section: SectionMeta }
  | { kind: "line"; lineIndex: number };

function isBracketSectionTitleLine(lines: ConfigLine[], i: number): boolean {
  if (i <= 0) return false;
  const line = lines[i]?.line ?? "";
  if (!line.startsWith("[") || !line.endsWith("]")) return false;
  return (lines[i - 1]?.line ?? "").startsWith("// ");
}

function sectionStats(
  start: number,
  end: number,
  lineKindByIndex: readonly ("add" | "removed" | "change" | "context")[],
): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (let i = start; i < end; i++) {
    const k = lineKindByIndex[i] ?? "context";
    if (k === "add") added++;
    else if (k === "removed") removed++;
    else if (k === "change") {
      added++;
      removed++;
    }
  }
  return { added, removed };
}

/** Dump sections from `// id` headers. */
export function buildSectionMetas(
  lines: ConfigLine[],
  lineKindByIndex: readonly ("add" | "removed" | "change" | "context")[],
): SectionMeta[] {
  const sections: SectionMeta[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i]!.line.startsWith("// ")) {
      i++;
      continue;
    }
    const start = i;
    i++;
    while (i < lines.length && !lines[i]!.line.startsWith("// ")) i++;
    const end = i;
    const idRaw = lines[start]!.line.slice(3).trim();
    const entityIdParsed = Number.parseInt(idRaw, 10);
    const entityId = Number.isFinite(entityIdParsed) ? entityIdParsed : null;
    const titleLine =
      start + 1 < end && isBracketSectionTitleLine(lines, start + 1)
        ? lines[start + 1]!.line
        : lines[start]!.line;
    const stats = sectionStats(start, end, lineKindByIndex);
    sections.push({
      start,
      end,
      title: sectionTitleFromBracket(titleLine),
      entityId,
      added: stats.added,
      removed: stats.removed,
    });
  }
  return sections;
}

/**
 * Insert an in-flow section header before the first visible line of each section.
 */
export function buildTextViewRowsWithHeaders(
  displayIndices: readonly number[],
  sections: readonly SectionMeta[],
): TextViewRow[] {
  if (displayIndices.length === 0) return [];
  const sectionForLine = (li: number): SectionMeta | null => {
    for (const s of sections) {
      if (li >= s.start && li < s.end) return s;
    }
    return null;
  };

  const out: TextViewRow[] = [];
  const emitted = new Set<number>();
  for (const li of displayIndices) {
    const section = sectionForLine(li);
    if (section && !emitted.has(section.start)) {
      emitted.add(section.start);
      out.push({ kind: "header", section });
    }
    out.push({ kind: "line", lineIndex: li });
  }
  return out;
}

export function sectionMatchesFocus(
  title: string,
  focusBracketTitle: string | null | undefined,
  entityId?: number | null,
): boolean {
  return sectionTitleMatchesFocus(title, focusBracketTitle, entityId);
}

/** Insert in-flow section headers into an existing virtual row list (lines + collapses). */
export function insertSectionHeadersIntoViewRows<
  T extends { kind: string; lineIndex?: number },
>(
  rows: readonly T[],
  sections: readonly SectionMeta[],
): Array<T | { kind: "header"; section: SectionMeta }> {
  if (rows.length === 0 || sections.length === 0) return [...rows];
  const sectionForLine = (li: number): SectionMeta | null => {
    for (const s of sections) {
      if (li >= s.start && li < s.end) return s;
    }
    return null;
  };
  const out: Array<T | { kind: "header"; section: SectionMeta }> = [];
  const emitted = new Set<number>();
  for (const row of rows) {
    if (row.kind === "line" && typeof row.lineIndex === "number") {
      const section = sectionForLine(row.lineIndex);
      if (section && !emitted.has(section.start)) {
        emitted.add(section.start);
        out.push({ kind: "header", section });
      }
    }
    out.push(row);
  }
  return out;
}

export function sectionTone(
  added: number,
  removed: number,
): "add" | "removed" | "change" | "context" {
  if (added > 0 && removed === 0) return "add";
  if (removed > 0 && added === 0) return "removed";
  if (added > 0 && removed > 0) return "change";
  return "context";
}

/** In-flow section chrome (not sticky) — matches block headers between hunks. */
export function SectionChromeHeader({
  title,
  added,
  removed,
  isCurrent,
  hoverInfo,
  definitionLabel,
}: {
  title: string;
  added: number;
  removed: number;
  isCurrent: boolean;
  hoverInfo?: SectionTitleHoverInfo | null;
  definitionLabel?: string;
}) {
  const tone = sectionTone(added, removed);
  return (
    <div
      className={cn(
        "flex h-full w-full items-center gap-2 border-y px-2.5 font-sans text-[11px]",
        tone === "add" && "border-emerald-700/40 bg-emerald-950/55",
        tone === "removed" && "border-rose-700/40 bg-rose-950/55",
        tone === "change" && "border-sky-700/40 bg-sky-950/50",
        tone === "context" && "border-amber-700/35 bg-zinc-900/90",
        isCurrent && "ring-1 ring-inset ring-sky-400/50",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[3px] text-[9px] font-bold text-zinc-950",
          tone === "add" && "bg-emerald-400",
          tone === "removed" && "bg-rose-400",
          tone === "change" && "bg-sky-400",
          tone === "context" && "bg-amber-500",
        )}
        aria-hidden
      >
        {tone === "add" ? "A" : tone === "removed" ? "R" : tone === "change" ? "C" : "·"}
      </span>
      {isCurrent ? (
        <span className="rounded-full bg-sky-600 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white">
          Current
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-center font-mono text-[12px] text-zinc-200">
        {hoverInfo ? (
          <DumpSectionTitleHover
            info={{ ...hoverInfo, isCurrent: hoverInfo.isCurrent || isCurrent }}
            definitionLabel={definitionLabel}
            className="text-[12px] text-zinc-100 decoration-zinc-400/70 hover:text-white hover:decoration-zinc-200"
          />
        ) : (
          title
        )}
      </span>
      <span className="shrink-0 font-mono text-[11px] tabular-nums">
        <span className="text-emerald-400">+{added}</span>
        <span className="text-zinc-500"> / </span>
        <span className="text-rose-400">-{removed}</span>
      </span>
    </div>
  );
}

/** Right-edge change overview (replaces left line-number gutter). */
export function DiffChangeMinimap({
  marks,
  scrollTop,
  viewportH,
  totalH,
}: {
  marks: readonly { topPct: number; kind: "add" | "removed" | "change" }[];
  scrollTop: number;
  viewportH: number;
  totalH: number;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 z-10 w-2.5 border-l border-border/40 bg-zinc-950/40"
      aria-hidden
    >
      {marks.map((m, i) => (
        <span
          key={`${m.topPct}-${i}`}
          className={cn(
            "absolute right-0.5 h-0.5 w-1.5 rounded-sm",
            m.kind === "add" && "bg-emerald-400",
            m.kind === "removed" && "bg-rose-400",
            m.kind === "change" && "bg-sky-400",
          )}
          style={{ top: `${m.topPct}%` }}
        />
      ))}
      {totalH > 0 ? (
        <span
          className="absolute right-0 w-full rounded-sm bg-sky-500/25"
          style={{
            top: `${Math.min(100, (scrollTop / Math.max(totalH, 1)) * 100)}%`,
            height: `${Math.min(100, (viewportH / Math.max(totalH, 1)) * 100)}%`,
          }}
        />
      ) : null}
    </div>
  );
}

/** @deprecated use buildSectionMetas */
export const buildStickySections = (
  lines: ConfigLine[],
  lineKindByIndex: readonly ("add" | "removed" | "change" | "context")[],
  displayIndices: readonly number[],
): Array<SectionMeta & { viewStart: number; viewEnd: number }> => {
  const sections = buildSectionMetas(lines, lineKindByIndex);
  const lineToView = new Map<number, number>();
  for (let vi = 0; vi < displayIndices.length; vi++) {
    lineToView.set(displayIndices[vi]!, vi);
  }
  return sections.map((s) => {
    let viewStart = 0;
    let viewEnd = Math.max(0, displayIndices.length - 1);
    for (let li = s.start; li < s.end; li++) {
      const vi = lineToView.get(li);
      if (vi != null) {
        viewStart = vi;
        break;
      }
    }
    for (let li = s.end - 1; li >= s.start; li--) {
      const vi = lineToView.get(li);
      if (vi != null) {
        viewEnd = vi;
        break;
      }
    }
    return { ...s, viewStart, viewEnd };
  });
};

/** @deprecated sticky overlay removed — kept for brief import compatibility */
export function stickySectionAtScroll(
  sections: readonly { viewStart: number }[],
  scrollTop: number,
  viewRowCount: number,
  rowHeight: number,
): (typeof sections)[number] | null {
  if (sections.length === 0 || viewRowCount === 0 || rowHeight <= 0) return null;
  const topVi = Math.max(0, Math.min(viewRowCount - 1, Math.floor(scrollTop / rowHeight)));
  let best: (typeof sections)[number] | null = null;
  for (const s of sections) {
    if (s.viewStart <= topVi) best = s;
    else break;
  }
  return best;
}
