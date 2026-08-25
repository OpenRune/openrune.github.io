"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSettings } from "@/context/settings-context";
import { cn } from "@/lib/utils";
import { getConfigBlocks, trimBlockEndExclusive, type ConfigSectionBlock } from "@/lib/diff-config-blocks";

import { RsColorBox } from "@/components/ui/rs-color-box";
import { RSTexture } from "@/components/ui/RSTexture";
import { useDiffExplorerFocus } from "./diff-explorer-focus";
import { DumpSyntaxText, SearchHitHighlightedText } from "./diff-dump-syntax";
import {
  buildSectionMetas,
  DiffChangeMinimap,
  insertSectionHeadersIntoViewRows,
  SectionChromeHeader,
  sectionMatchesFocus,
  type SectionMeta,
} from "./diff-section-sticky";
import {
  buildSectionTitleHoverByLineIndex,
  DumpSectionTitleHover,
} from "./diff-section-title-tooltip";
import {
  buildPrefixOffsets,
  estimateCharsPerLine,
  estimateWrappedRowUnits,
  virtualWindowFromOffsets,
} from "./diff-text-wrap";
import { inConfigSectionBlock } from "./diff-config-line-filter";
import { findConfigFocusLineIndex, configLineMatchesFocusNeedle, bareFocusTitle, parseFocusEntityId } from "./diff-focus-match";
import { sectionGamevalTypeForSection } from "./diff-constants";
import type { ConfigFilterMode, ConfigLine } from "./diff-types";
import { useGamevals } from "@/context/gameval-context";

const LINE_H = 22;
const OVERSCAN = 14;
/** Collapse context runs longer than this when showing the full file. */
const CONTEXT_COLLAPSE_MIN = 10;

type InlineDiffSeg = { text: string; kind: "same" | "add" | "remove" };

type ViewRow =
  | { kind: "line"; lineIndex: number }
  | { kind: "collapse"; count: number }
  | { kind: "header"; section: SectionMeta };

function getColorFieldType(name: string): "hsl" | "rgb" | null {
  const l = name.toLowerCase();
  if (l === "modifiedtexturecolours" || l === "modifiedtexturecolors") return null;
  if (l === "originaltexturecolours" || l === "originaltexturecolors") return null;
  if (l === "rgb" || l.endsWith("rgb")) return "rgb";
  if (l.includes("colour") || l.includes("color")) return "hsl";
  return null;
}

function isTextureField(name: string): boolean {
  const l = name.toLowerCase();
  if (l === "modifiedtexturecolours" || l === "modifiedtexturecolors") return true;
  if (l === "originaltexturecolours" || l === "originaltexturecolors") return true;
  return l === "texture" || l.endsWith("texture") || l.endsWith("textureid");
}

function displayTextureFieldName(name: string): string {
  const l = name.toLowerCase();
  if (l === "modifiedtexturecolours" || l === "modifiedtexturecolors") return "modifiedTexture";
  if (l === "originaltexturecolours" || l === "originaltexturecolors") return "originalTexture";
  return name;
}

function displayTextureFieldLine(text: string): string {
  const eqIdx = text.indexOf("=");
  if (eqIdx <= 0) return text;
  const name = text.slice(0, eqIdx).trim();
  const displayName = displayTextureFieldName(name);
  if (displayName === name) return text;
  return `${displayName}${text.slice(eqIdx)}`;
}

function getFieldName(line: string): string | null {
  const i = line.indexOf("=");
  return i > 0 ? line.slice(0, i).trim() : null;
}

/** True when the value after `=` is a list/array (contains `[` or `,`). */
function isArrayValue(rest: string): boolean {
  return rest.includes("[") || rest.includes(",");
}

function RsColorSwatch({ value, kind }: { value: number; kind: "hsl" | "rgb" }) {
  return (
    <span className="mx-1.5 inline-block align-middle" style={{ lineHeight: 0 }}>
      {kind === "hsl" ? (
        <RsColorBox packedHsl={value} width={12} height={12} className="rounded-[2px]" />
      ) : (
        <RsColorBox rgb24={value} width={12} height={12} className="rounded-[2px]" />
      )}
    </span>
  );
}

function RsTextureSwatch({ value }: { value: number }) {
  return (
    <span className="mx-1.5 inline-block align-middle" style={{ lineHeight: 0 }}>
      <RSTexture
        id={value}
        width={12}
        height={12}
        className="rounded-[2px]"
        enableClickModel
        modalTitle={`Texture [${value}]`}
      />
    </span>
  );
}

export function ColorLineText({
  text,
  query,
  enableWidgets = true,
}: {
  text: string;
  query: string;
  enableWidgets?: boolean;
}) {
  const displayText = displayTextureFieldLine(text);
  const fn = getFieldName(text);
  const colorKind = fn ? getColorFieldType(fn) : null;
  const textureField = fn ? isTextureField(fn) : false;
  if (!colorKind && !textureField) {
    return <DumpSyntaxText text={displayText} query={query} />;
  }
  const eqIdx = displayText.indexOf("=");
  const prefix = displayText.slice(0, eqIdx);
  const eq = displayText.slice(eqIdx, eqIdx + 1);
  const rest = displayText.slice(eqIdx + 1);
  const isArray = isArrayValue(rest);
  const parts: React.ReactNode[] = [
    <span key="pfx" className="text-fuchsia-600 dark:text-fuchsia-400">
      <SearchHitHighlightedText text={prefix} query={query} />
    </span>,
    <span key="eq" className="text-zinc-400 dark:text-zinc-300">
      {eq}
    </span>,
  ];
  const re = /(-?\d+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) {
    if (m.index > last)
      parts.push(
        <span key={`t${last}`} className="text-teal-600 dark:text-teal-300">
          <SearchHitHighlightedText text={rest.slice(last, m.index)} query={query} />
        </span>,
      );
    const widget = colorKind ? (
      <RsColorSwatch key={`sw${m.index}`} value={+m[1]} kind={colorKind} />
    ) : (
      <RsTextureSwatch key={`sw${m.index}`} value={+m[1]} />
    );
    if (enableWidgets && isArray) parts.push(widget);
    parts.push(
      <span key={`n${m.index}`} className="text-emerald-600 dark:text-emerald-300">
        <SearchHitHighlightedText text={m[1]} query={query} />
      </span>,
    );
    if (enableWidgets && !isArray) parts.push(widget);
    last = m.index + m[1].length;
  }
  if (last < rest.length)
    parts.push(
      <span key="tend" className="text-teal-600 dark:text-teal-300">
        <SearchHitHighlightedText text={rest.slice(last)} query={query} />
      </span>,
    );
  return <>{parts}</>;
}

function tokenizeWithWhitespace(text: string): string[] {
  const parts = text.split(/(\s+)/g);
  return parts.filter((p) => p.length > 0);
}

function tokenDiff(before: string, after: string): InlineDiffSeg[] {
  const a = tokenizeWithWhitespace(before || "");
  const b = tokenizeWithWhitespace(after || "");
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) lcs[i][j] = lcs[i + 1][j + 1] + 1;
      else lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: InlineDiffSeg[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ text: a[i], kind: "same" });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ text: a[i], kind: "remove" });
      i++;
    } else {
      out.push({ text: b[j], kind: "add" });
      j++;
    }
  }
  while (i < n) {
    out.push({ text: a[i], kind: "remove" });
    i++;
  }
  while (j < m) {
    out.push({ text: b[j], kind: "add" });
    j++;
  }
  return out;
}

function ChangedInlineText({
  before,
  after,
  query,
  enableWidgets = true,
}: {
  before: string;
  after: string;
  query: string;
  enableWidgets?: boolean;
}) {
  const displayBefore = React.useMemo(() => displayTextureFieldLine(before), [before]);
  const displayAfter = React.useMemo(() => displayTextureFieldLine(after), [after]);
  const segments = React.useMemo(() => tokenDiff(displayBefore, displayAfter), [displayBefore, displayAfter]);
  const fieldName = getFieldName(before || after) ?? "";
  const colorKind = getColorFieldType(fieldName);
  const textureField = isTextureField(fieldName);
  const eqIdx = (displayBefore || displayAfter).indexOf("=");
  const isArray = eqIdx >= 0 && isArrayValue((displayBefore || displayAfter).slice(eqIdx + 1));
  return (
    <>
      {segments.map((seg, i) => {
        const isNum = (Boolean(colorKind) || textureField) && /^-?\d+$/.test(seg.text);
        const swatchBefore =
          enableWidgets && isNum && isArray
            ? (colorKind ? <RsColorSwatch value={+seg.text} kind={colorKind} /> : <RsTextureSwatch value={+seg.text} />)
            : null;
        const swatchAfter =
          enableWidgets && isNum && !isArray
            ? (colorKind ? <RsColorSwatch value={+seg.text} kind={colorKind} /> : <RsTextureSwatch value={+seg.text} />)
            : null;
        if (seg.kind === "same") {
          return (
            <React.Fragment key={i}>
              {swatchBefore}
              <DumpSyntaxText text={seg.text} query={query} />
              {swatchAfter}
            </React.Fragment>
          );
        }
        if (seg.kind === "add") {
          return (
            <React.Fragment key={i}>
              {swatchBefore}
              <span className="rounded-[2px] bg-emerald-400/45 px-0.5 text-emerald-950 dark:bg-emerald-400/35 dark:text-emerald-50">
                <SearchHitHighlightedText text={seg.text} query={query} />
              </span>
              {swatchAfter}
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key={i}>
            {swatchBefore}
            <span className="rounded-[2px] bg-rose-400/45 px-0.5 text-rose-950 line-through opacity-90 dark:bg-rose-500/40 dark:text-rose-50">
              <SearchHitHighlightedText text={seg.text} query={query} />
            </span>
            {swatchAfter}
          </React.Fragment>
        );
      })}
    </>
  );
}

type DiffConfigDiffTextProps = {
  lines: ConfigLine[];
  filterMode: ConfigFilterMode;
  searchQuery: string;
  layout?: "unified" | "split";
  /** Config section id for hover tooltips (`overlay`, `items`, …). */
  configType?: string;
};

function ChangedSideText({
  before,
  after,
  query,
  side,
  enableWidgets = true,
}: {
  before: string;
  after: string;
  query: string;
  side: "left" | "right";
  enableWidgets?: boolean;
}) {
  const displayBefore = React.useMemo(() => displayTextureFieldLine(before), [before]);
  const displayAfter = React.useMemo(() => displayTextureFieldLine(after), [after]);
  const segments = React.useMemo(() => tokenDiff(displayBefore, displayAfter), [displayBefore, displayAfter]);
  const fieldName = getFieldName(before || after) ?? "";
  const colorKind = getColorFieldType(fieldName);
  const textureField = isTextureField(fieldName);
  const eqIdx = (displayBefore || displayAfter).indexOf("=");
  const isArray = eqIdx >= 0 && isArrayValue((displayBefore || displayAfter).slice(eqIdx + 1));
  return (
    <>
      {segments.map((seg, i) => {
        const isNum = (Boolean(colorKind) || textureField) && /^-?\d+$/.test(seg.text);
        const swatchBefore =
          enableWidgets && isNum && isArray
            ? (colorKind ? <RsColorSwatch value={+seg.text} kind={colorKind} /> : <RsTextureSwatch value={+seg.text} />)
            : null;
        const swatchAfter =
          enableWidgets && isNum && !isArray
            ? (colorKind ? <RsColorSwatch value={+seg.text} kind={colorKind} /> : <RsTextureSwatch value={+seg.text} />)
            : null;
        if (seg.kind === "same") {
          return (
            <React.Fragment key={i}>
              {swatchBefore}
              <DumpSyntaxText text={seg.text} query={query} />
              {swatchAfter}
            </React.Fragment>
          );
        }
        if (side === "left" && seg.kind === "remove") {
          return (
            <React.Fragment key={i}>
              {swatchBefore}
              <span className="rounded-[2px] bg-rose-400/45 px-0.5 text-rose-950 line-through opacity-90 dark:bg-rose-500/40 dark:text-rose-50">
                <SearchHitHighlightedText text={seg.text} query={query} />
              </span>
              {swatchAfter}
            </React.Fragment>
          );
        }
        if (side === "right" && seg.kind === "add") {
          return (
            <React.Fragment key={i}>
              {swatchBefore}
              <span className="rounded-[2px] bg-emerald-400/45 px-0.5 text-emerald-950 dark:bg-emerald-400/35 dark:text-emerald-50">
                <SearchHitHighlightedText text={seg.text} query={query} />
              </span>
              {swatchAfter}
            </React.Fragment>
          );
        }
        return null;
      })}
    </>
  );
}

function passesSearch(i: number, lines: ConfigLine[], q: string): boolean {
  return configLineMatchesFocusNeedle(lines, i, q);
}

function isBracketSectionTitleLine(lines: ConfigLine[], i: number): boolean {
  if (i <= 0) return false;
  const line = lines[i]?.line ?? "";
  if (!line.startsWith("[") || !line.endsWith("]")) return false;
  return (lines[i - 1]?.line ?? "").startsWith("// ");
}

function withFieldPrefixIfMissing(before: string | null | undefined, after: string): string | null | undefined {
  if (before == null) return before;
  if (!after.includes("=") || before.includes("=")) return before;
  const eq = after.indexOf("=");
  if (eq <= 0) return before;
  return `${after.slice(0, eq + 1)}${before}`;
}

function isStructuralLine(lines: ConfigLine[], i: number): boolean {
  const line = lines[i]?.line ?? "";
  return line.startsWith("// ") || isBracketSectionTitleLine(lines, i);
}

function buildViewRows(
  lines: ConfigLine[],
  visibleIndices: number[],
  lineKindByIndex: readonly ("add" | "removed" | "change" | "context")[],
  filterMode: ConfigFilterMode,
  searchQuery: string,
): ViewRow[] {
  if (filterMode !== "all" || searchQuery.trim()) {
    return visibleIndices.map((lineIndex) => ({ kind: "line" as const, lineIndex }));
  }

  const out: ViewRow[] = [];
  let i = 0;
  while (i < visibleIndices.length) {
    const li = visibleIndices[i]!;
    if ((lineKindByIndex[li] ?? "context") === "context" && !isStructuralLine(lines, li)) {
      let j = i + 1;
      while (j < visibleIndices.length) {
        const lj = visibleIndices[j]!;
        if ((lineKindByIndex[lj] ?? "context") !== "context" || isStructuralLine(lines, lj)) break;
        j++;
      }
      const count = j - i;
      if (count >= CONTEXT_COLLAPSE_MIN) {
        out.push({ kind: "collapse", count });
      } else {
        for (let k = i; k < j; k++) out.push({ kind: "line", lineIndex: visibleIndices[k]! });
      }
      i = j;
      continue;
    }
    out.push({ kind: "line", lineIndex: li });
    i++;
  }
  return out;
}

function CollapseSeparator({ count }: { count: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center gap-3 border-y border-border/30 bg-muted/20 px-3 text-[11px] text-sky-700/80 dark:bg-zinc-900/50 dark:text-sky-400/70">
      <span className="h-px flex-1 bg-border/60" />
      <span className="shrink-0 font-mono tabular-nums">
        … {count.toLocaleString()} unchanged lines
      </span>
      <span className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function tooltipBody(row: ConfigLine, inSection: boolean): React.ReactNode {
  if (inSection) return null;
  const { type, addedInRev: ar, changedInRev: cr, before, removedInRev: rr, line } = row;
  const beforeDisplay = withFieldPrefixIfMissing(before, line);
  if (type === "add" && ar != null) return <>Added in rev {ar}</>;
  if (type === "removed" && rr != null) return <>Removed in rev {rr}</>;
  if (type === "change" && (cr != null || beforeDisplay != null))
    return (
      <span className="block space-y-1">
        {cr != null ? <span className="block">Changed in rev {cr}</span> : null}
        {beforeDisplay != null ? (
          <span className="block font-mono text-xs">
            Before: {beforeDisplay}
            <br />
            After: {line}
          </span>
        ) : null}
      </span>
    );
  return null;
}

export function DiffConfigDiffText({
  lines,
  filterMode,
  searchQuery,
  layout = "split",
  configType = "config",
}: DiffConfigDiffTextProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportH, setViewportH] = React.useState(400);
  const [viewportW, setViewportW] = React.useState(800);
  const { focusBracketTitle, focusNonce } = useDiffExplorerFocus();
  const { lookupGamevalByName } = useGamevals();
  const { settings } = useSettings();
  const wordWrap = settings.editorWordWrap;

  const blocks = React.useMemo(() => getConfigBlocks(lines), [lines]);

  /** Per-line kind for styling (includes body lines inside add/remove section blocks). */
  const lineKindByIndex = React.useMemo((): ("add" | "removed" | "change" | "context")[] => {
    const addDelta = new Int32Array(lines.length + 1);
    const remDelta = new Int32Array(lines.length + 1);
    for (const b of blocks) {
      const end = trimBlockEndExclusive(lines, b);
      if (b.start >= end) continue;
      if (b.type === "add") {
        addDelta[b.start] += 1;
        addDelta[end] -= 1;
      } else if (b.type === "removed") {
        remDelta[b.start] += 1;
        remDelta[end] -= 1;
      }
    }
    const out: ("add" | "removed" | "change" | "context")[] = [];
    let addDepth = 0;
    let remDepth = 0;
    for (let i = 0; i < lines.length; i++) {
      addDepth += addDelta[i] ?? 0;
      remDepth += remDelta[i] ?? 0;
      const row = lines[i]!;
      if (row.type === "change") {
        out.push("change");
        continue;
      }
      if (addDepth > 0) out.push("add");
      else if (remDepth > 0) out.push("removed");
      else if (row.type === "add") out.push("add");
      else if (row.type === "removed") out.push("removed");
      else out.push("context");
    }
    return out;
  }, [lines, blocks]);

  const visibleIndices = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const bodyVisible = new Array<boolean>(lines.length).fill(false);
    if (filterMode === "all") {
      bodyVisible.fill(true);
    } else {
      const wantKind =
        filterMode === "added" ? "add" : filterMode === "removed" ? "removed" : "change";
      for (let i = 0; i < lines.length; i++) {
        const row = lines[i]!;
        if (row.line.startsWith("// ") || isBracketSectionTitleLine(lines, i)) continue;
        const kind = lineKindByIndex[i] ?? "context";
        bodyVisible[i] = wantKind === "change" ? row.type === "change" : kind === wantKind;
      }
    }

    const sectionVisible = new Array<boolean>(lines.length).fill(false);
    let sectionStart = -1;
    let hasVisibleBody = false;
    const flushSection = (endExclusive: number) => {
      if (sectionStart < 0) return;
      sectionVisible[sectionStart] = hasVisibleBody;
      const titleIdx = sectionStart + 1;
      if (titleIdx < endExclusive && isBracketSectionTitleLine(lines, titleIdx)) {
        sectionVisible[titleIdx] = hasVisibleBody;
      }
    };
    for (let i = 0; i <= lines.length; i++) {
      const isHeader = i < lines.length && lines[i]!.line.startsWith("// ");
      if (isHeader || i === lines.length) {
        flushSection(i);
        sectionStart = i < lines.length ? i : -1;
        hasVisibleBody = false;
        continue;
      }
      if (sectionStart >= 0 && bodyVisible[i]) hasVisibleBody = true;
    }

    const arr: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const visible = filterMode === "all" ? true : (bodyVisible[i] || sectionVisible[i]);
      if (visible && passesSearch(i, lines, q)) arr.push(i);
    }
    return arr;
  }, [lines, filterMode, searchQuery, lineKindByIndex]);

  const viewRows = React.useMemo(() => {
    const base = buildViewRows(lines, visibleIndices, lineKindByIndex, filterMode, searchQuery);
    const sections = buildSectionMetas(lines, lineKindByIndex);
    return insertSectionHeadersIntoViewRows(base, sections) as ViewRow[];
  }, [filterMode, lineKindByIndex, lines, searchQuery, visibleIndices]);

  const sectionMetas = React.useMemo(() => buildSectionMetas(lines, lineKindByIndex), [lines, lineKindByIndex]);

  const sectionTitleHoverByLineIndex = React.useMemo(
    () => buildSectionTitleHoverByLineIndex(lines, sectionMetas, configType, focusBracketTitle),
    [lines, sectionMetas, configType, focusBracketTitle],
  );

  const definitionLabel = React.useMemo(() => {
    const t = configType.trim().toLowerCase();
    return t && t !== "config" ? `config.${t}` : undefined;
  }, [configType]);

  const minimapMarks = React.useMemo(() => {
    const marks: { topPct: number; kind: "add" | "removed" | "change" }[] = [];
    const n = viewRows.length;
    if (n === 0) return marks;
    for (let vi = 0; vi < n; vi++) {
      const row = viewRows[vi]!;
      if (row.kind !== "line") continue;
      const dk = lineKindByIndex[row.lineIndex] ?? "context";
      if (dk === "context") continue;
      marks.push({ topPct: (vi / n) * 100, kind: dk });
    }
    return marks;
  }, [lineKindByIndex, viewRows]);

  const onScroll = React.useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
  }, []);

  React.useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const apply = () => {
      setViewportH(el.clientHeight || 400);
      setViewportW(el.clientWidth || 800);
    };
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    apply();
    return () => ro.disconnect();
  }, []);

  const rowHeights = React.useMemo(() => {
    if (!wordWrap) return viewRows.map(() => LINE_H);
    const cols = layout === "split" ? 2 : 1;
    const chars = estimateCharsPerLine(viewportW, cols);
    return viewRows.map((viewRow) => {
      if (viewRow.kind === "header" || viewRow.kind === "collapse") return LINE_H;
      const row = lines[viewRow.lineIndex];
      const text = row?.line ?? " ";
      const before = row?.before ?? "";
      const units = Math.max(estimateWrappedRowUnits(text, chars), estimateWrappedRowUnits(before, chars));
      return units * LINE_H;
    });
  }, [layout, lines, viewRows, viewportW, wordWrap]);

  const rowPrefix = React.useMemo(() => buildPrefixOffsets(rowHeights), [rowHeights]);

  const totalH = rowPrefix[viewRows.length] ?? 0;
  const wrapWindow = wordWrap
    ? virtualWindowFromOffsets(rowPrefix, scrollTop, viewportH, OVERSCAN)
    : null;
  const start = wrapWindow
    ? wrapWindow.start
    : viewRows.length === 0
      ? 0
      : Math.max(0, Math.floor(scrollTop / LINE_H) - OVERSCAN);
  const end = wrapWindow
    ? Math.max(wrapWindow.start, wrapWindow.end - 1)
    : viewRows.length === 0
      ? -1
      : Math.min(viewRows.length - 1, Math.ceil((scrollTop + viewportH) / LINE_H) + OVERSCAN);
  const visibleStart = wrapWindow
    ? wrapWindow.start
    : viewRows.length === 0
      ? 0
      : Math.max(0, Math.floor(scrollTop / LINE_H));
  const visibleEnd = wrapWindow
    ? Math.max(wrapWindow.start, wrapWindow.end - 1)
    : viewRows.length === 0
      ? -1
      : Math.min(viewRows.length - 1, Math.ceil((scrollTop + viewportH) / LINE_H));

  React.useEffect(() => {
    if (!focusNonce || !focusBracketTitle) return;
    const el = parentRef.current;
    if (!el) return;
    let resolvedId = parseFocusEntityId(focusBracketTitle);
    if (resolvedId == null) {
      const gvType = sectionGamevalTypeForSection(configType);
      const name = bareFocusTitle(focusBracketTitle);
      if (gvType && name) {
        resolvedId = lookupGamevalByName(gvType, name) ?? null;
      }
    }
    const sourceIdx = findConfigFocusLineIndex(lines, focusBracketTitle, resolvedId);
    if (sourceIdx < 0) return;
    const vi = viewRows.findIndex((r) => r.kind === "line" && r.lineIndex === sourceIdx);
    if (vi < 0) return;
    el.scrollTop = Math.max(0, (rowPrefix[vi] ?? vi * LINE_H) - 8);
    setScrollTop(el.scrollTop);
  }, [focusBracketTitle, focusNonce, lines, viewRows, rowPrefix, configType, lookupGamevalByName]);

  /**
   * Tooltip trigger must not merge `className` onto the colored line/gutter nodes: Base UI passes
   * reference classes that tailwind-merge can resolve *after* our bg-* utilities, wiping tints.
   * Wrap children in a plain flex container and forward trigger props there only.
   */
  const wrapTooltip = (node: React.ReactNode, tip: React.ReactNode, key: React.Key) => {
    if (!tip) return <React.Fragment key={key}>{node}</React.Fragment>;
    const renderTrigger: NonNullable<TooltipPrimitive.Trigger.Props["render"]> = (props) => (
      <div {...props} className={cn("flex h-full min-h-[22px] w-full min-w-0 items-stretch", props.className)}>
        {node}
      </div>
    );
    return (
      <Tooltip key={key}>
        <TooltipTrigger render={renderTrigger} />
        <TooltipContent
          opaque
          side="right"
          className="max-w-sm border border-zinc-800 bg-zinc-950 p-3 text-xs text-white"
        >
          {tip}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className="diff-codeview relative min-h-0 flex-1">
      <div
        ref={parentRef}
        className="absolute inset-0 overflow-auto bg-background"
        onScroll={onScroll}
      >
      <DiffChangeMinimap
        marks={minimapMarks}
        scrollTop={scrollTop}
        viewportH={viewportH}
        totalH={totalH}
      />

      <div className="relative min-h-[8rem] pr-2.5 font-mono text-xs" style={{ height: Math.max(totalH, 120) }}>
        {viewRows.length === 0 ? (
          <div className="p-4 text-muted-foreground">No lines match the current filter and search.</div>
        ) : null}
        {viewRows.length > 0 && end >= start
          ? Array.from({ length: end - start + 1 }, (_, k) => start + k)
              .filter((vi) => vi >= 0 && vi < viewRows.length)
              .map((vi) => {
              const viewRow = viewRows[vi]!;
              const top = rowPrefix[vi] ?? vi * LINE_H;
              const rowH = rowHeights[vi] ?? LINE_H;

              if (viewRow.kind === "header") {
                return (
                  <div
                    key={`hdr-${viewRow.section.start}`}
                    data-virtual-row
                    className="absolute left-0 flex w-full items-stretch"
                    style={{ top, height: rowH }}
                  >
                    <SectionChromeHeader
                      title={viewRow.section.title}
                      added={viewRow.section.added}
                      removed={viewRow.section.removed}
                      isCurrent={sectionMatchesFocus(
                        viewRow.section.title,
                        focusBracketTitle,
                        viewRow.section.entityId,
                      )}
                      hoverInfo={
                        viewRow.section.start + 1 < viewRow.section.end
                          ? sectionTitleHoverByLineIndex.get(viewRow.section.start + 1)
                          : undefined
                      }
                      definitionLabel={definitionLabel}
                    />
                  </div>
                );
              }

              if (viewRow.kind === "collapse") {
                return (
                  <div
                    key={`collapse-${vi}`}
                    data-virtual-row
                    className="absolute left-0 flex w-full items-stretch"
                    style={{ top, height: rowH }}
                  >
                    <CollapseSeparator count={viewRow.count} />
                  </div>
                );
              }

              const widgetsInView = vi >= visibleStart && vi <= visibleEnd;
              const lineIndex = viewRow.lineIndex;
              const row = lines[lineIndex];
              const beforeDisplay = withFieldPrefixIfMissing(row.before, row.line || " ");
              const inSection = inConfigSectionBlock(blocks, lineIndex);
              const lineTip = tooltipBody(row, inSection);
              const rawDk = lineKindByIndex[lineIndex] ?? "context";
              const dk: "add" | "removed" | "change" | "context" =
                rawDk === "change" &&
                beforeDisplay != null &&
                beforeDisplay.trim() === (row.line || " ").trim()
                  ? "context"
                  : rawDk;
              const barColor =
                dk === "add"
                  ? "bg-emerald-500"
                  : dk === "change"
                    ? "bg-sky-500"
                    : dk === "removed"
                      ? "bg-rose-500"
                      : null;

              const addRemovedBlock = blocks.find(
                (b) => (b.type === "add" || b.type === "removed") && lineIndex >= b.start && lineIndex < b.end,
              );
              let blockInfo: {
                endExclusive: number;
                isFirst: boolean;
                isLast: boolean;
                blockRev: number | null;
              } | null = null;
              if (addRemovedBlock) {
                const endExclusive = trimBlockEndExclusive(lines, addRemovedBlock);
                if (lineIndex < endExclusive) {
                  blockInfo = {
                    endExclusive,
                    isFirst: lineIndex === addRemovedBlock.start,
                    isLast: lineIndex === endExclusive - 1,
                    blockRev: addRemovedBlock.rev,
                  };
                }
              }

              const blockTooltipContent: React.ReactNode = blockInfo
                ? addRemovedBlock!.type === "add"
                  ? blockInfo.blockRev != null ? (
                    <>Added in rev {blockInfo.blockRev}</>
                  ) : (
                    <>Added</>
                  )
                  : blockInfo.blockRev != null ? (
                    <>Removed in rev {blockInfo.blockRev}</>
                  ) : (
                    <>Removed</>
                  )
                : null;
              const lineTooltipBody =
                blockTooltipContent && blockInfo && addRemovedBlock && blockInfo.endExclusive - addRemovedBlock.start > 1 ? (
                  <span className="block space-y-1">
                    <span className="block">{blockTooltipContent}</span>
                    <span className="mt-1.5 block border-t border-zinc-700 pt-1.5 text-zinc-400">
                      Lines {addRemovedBlock.start + 1}–{blockInfo.endExclusive}
                    </span>
                  </span>
                ) : (
                  blockTooltipContent
                );

              const showBlockRangeTip = Boolean(lineTooltipBody && blockInfo?.isFirst);

              const sectionHover = sectionTitleHoverByLineIndex.get(lineIndex);
              const lineInner = (
                <span
                  className={cn(
                    "diff-editor-line block w-full min-w-0 cursor-default px-3 py-0",
                    wordWrap ? "whitespace-pre-wrap break-words [overflow-wrap:anywhere]" : "whitespace-pre",
                    dk === "add" && "bg-emerald-500/20 dark:bg-emerald-500/16",
                    dk === "change" && "bg-sky-500/15 dark:bg-sky-500/12",
                    dk === "removed" && "bg-rose-500/20 dark:bg-rose-500/16",
                  )}
                >
                  {sectionHover ? (
                    <span className="font-mono text-xs leading-[22px]">
                      <span className="text-sky-500 dark:text-sky-400">[</span>
                      <DumpSectionTitleHover info={sectionHover} definitionLabel={definitionLabel} />
                      <span className="text-sky-500 dark:text-sky-400">]</span>
                    </span>
                  ) : dk === "change" && typeof row.before === "string" ? (
                    <ChangedInlineText
                      before={beforeDisplay ?? row.before}
                      after={row.line || " "}
                      query={searchQuery}
                      enableWidgets={widgetsInView}
                    />
                  ) : (
                    <ColorLineText text={row.line || " "} query={searchQuery} enableWidgets={widgetsInView} />
                  )}
                </span>
              );

              let content: React.ReactNode = lineInner;
              if (blockInfo && addRemovedBlock) {
                const blockClass =
                  addRemovedBlock.type === "add"
                    ? "border-emerald-600/50 bg-emerald-500/10 dark:border-emerald-500/40 dark:bg-emerald-500/8"
                    : "border-rose-600/50 bg-rose-500/10 dark:border-rose-500/40 dark:bg-rose-500/8";
                const wrapperClass = cn(
                  "ml-2 mr-1 min-h-full w-full min-w-0 overflow-hidden",
                  blockInfo.isFirst && "mt-1 rounded-t-md border-x border-t",
                  blockInfo.isLast && "mb-1 rounded-b-md border-x border-b",
                  !blockInfo.isFirst && !blockInfo.isLast && "border-x",
                );
                content = <div className={cn(wrapperClass, blockClass)}>{lineInner}</div>;
              } else if (!sectionHover) {
                content = wrapTooltip(lineInner, showBlockRangeTip ? lineTooltipBody : lineTip, `ln-${lineIndex}`);
              }

              const rowTint =
                dk === "add"
                  ? "bg-emerald-500/8 dark:bg-emerald-500/10"
                  : dk === "removed"
                    ? "bg-rose-500/8 dark:bg-rose-500/10"
                    : dk === "change"
                      ? "bg-sky-500/8 dark:bg-sky-500/10"
                      : "";

              if (layout === "split") {
                const hasBefore = typeof row.before === "string";
                const splitTip = showBlockRangeTip ? lineTooltipBody : lineTip;

                const leftContent =
                  dk === "add"
                    ? ""
                    : dk === "change"
                      ? hasBefore
                        ? (beforeDisplay ?? row.before!)
                        : ""
                      : row.line || " ";

                const rightContent = dk === "removed" ? "" : row.line || " ";

                const sectionTitleNode = sectionHover ? (
                  <span className="font-mono text-xs leading-[22px]">
                    <span className="text-sky-500 dark:text-sky-400">[</span>
                    <DumpSectionTitleHover info={sectionHover} definitionLabel={definitionLabel} />
                    <span className="text-sky-500 dark:text-sky-400">]</span>
                  </span>
                ) : null;

                const leftNode = sectionTitleNode && dk !== "add"
                  ? sectionTitleNode
                  : dk === "change" && hasBefore ? (
                    <ChangedSideText
                      before={beforeDisplay ?? row.before!}
                      after={row.line || " "}
                      query={searchQuery}
                      side="left"
                      enableWidgets={widgetsInView}
                    />
                  ) : leftContent ? (
                    <ColorLineText text={leftContent} query={searchQuery} enableWidgets={widgetsInView} />
                  ) : null;

                const rightNode = sectionTitleNode && dk !== "removed"
                  ? sectionTitleNode
                  : dk === "change" && hasBefore ? (
                    <ChangedSideText
                      before={beforeDisplay ?? row.before!}
                      after={row.line || " "}
                      query={searchQuery}
                      side="right"
                      enableWidgets={widgetsInView}
                    />
                  ) : rightContent ? (
                    <ColorLineText text={rightContent} query={searchQuery} enableWidgets={widgetsInView} />
                  ) : null;

                const leftBg =
                  dk === "removed" || dk === "change"
                    ? "bg-rose-500/14 dark:bg-rose-500/12"
                    : "bg-transparent";
                const rightBg =
                  dk === "add" || dk === "change"
                    ? "bg-emerald-500/14 dark:bg-emerald-500/12"
                    : "bg-transparent";

                const paneWithTip = (node: React.ReactNode, side: "left" | "right") => {
                  if (sectionHover || !splitTip || !node) return node;
                  return (
                    <Tooltip>
                      <TooltipTrigger
                        render={(props) => (
                          <div {...props} className={cn("h-full min-w-0 flex-1", props.className)}>
                            {node}
                          </div>
                        )}
                      />
                      <TooltipContent
                        opaque
                        side={side}
                        className="max-w-sm border border-zinc-800 bg-zinc-950 p-3 text-xs text-white"
                      >
                        {splitTip}
                      </TooltipContent>
                    </Tooltip>
                  );
                };

                return (
                  <div
                    key={lineIndex}
                    data-virtual-row
                    className="absolute left-0 flex w-full items-stretch"
                    style={{ top, height: rowH }}
                  >
                    <div className="flex min-w-0 flex-1 border-r border-border/30">
                      <div
                        className={cn(
                          "w-0.5 shrink-0 self-stretch",
                          dk === "removed" || dk === "change" ? "bg-rose-500/80" : "bg-transparent",
                        )}
                        aria-hidden
                      />
                      <div className={cn(
                        "diff-editor-line-host min-w-0 flex-1 px-3 py-0 font-mono text-xs leading-[22px]",
                        wordWrap ? "overflow-x-hidden overflow-y-visible whitespace-pre-wrap break-words" : "overflow-hidden",
                        leftBg,
                      )}>
                        {paneWithTip(leftNode, "left")}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1">
                      <div
                        className={cn(
                          "w-0.5 shrink-0 self-stretch",
                          dk === "add" || dk === "change" ? "bg-emerald-500/80" : "bg-transparent",
                        )}
                        aria-hidden
                      />
                      <div className={cn(
                        "diff-editor-line-host min-w-0 flex-1 px-3 py-0 font-mono text-xs leading-[22px]",
                        wordWrap ? "overflow-x-hidden overflow-y-visible whitespace-pre-wrap break-words" : "overflow-hidden",
                        rightBg,
                      )}>
                        {paneWithTip(rightNode, "right")}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={lineIndex}
                  data-virtual-row
                  className={cn("absolute left-0 flex w-full items-stretch", rowTint)}
                  style={{ top, height: rowH }}
                >
                  <div className={cn("w-0.5 shrink-0 self-stretch", barColor ?? "bg-transparent")} aria-hidden />
                  <div className="min-w-0 flex-1 border-b border-border/20">{content}</div>
                </div>
              );
            })
          : null}
      </div>
      </div>
    </div>
  );
}
