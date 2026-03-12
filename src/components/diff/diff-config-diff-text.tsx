"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getConfigBlocks, trimBlockEndExclusive, type ConfigSectionBlock } from "@/lib/diff-config-blocks";

import { RsColorBox } from "@/components/ui/rs-color-box";
import { RSTexture } from "@/components/ui/RSTexture";
import { inConfigSectionBlock } from "./diff-config-line-filter";
import type { ConfigFilterMode, ConfigLine } from "./diff-types";

const LINE_H = 22;
const OVERSCAN = 14;

type HighlightSeg = { text: string; highlight: boolean };
type InlineDiffSeg = { text: string; kind: "same" | "add" | "remove" };

function splitHighlightLiteral(text: string, needleRaw: string): HighlightSeg[] {
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
    return <SearchHitHighlightedText text={displayText} query={query} />;
  }
  const eqIdx = displayText.indexOf("=");
  const prefix = displayText.slice(0, eqIdx + 1);
  const rest = displayText.slice(eqIdx + 1);
  const isArray = isArrayValue(rest);
  const parts: React.ReactNode[] = [
    <SearchHitHighlightedText key="pfx" text={prefix} query={query} />,
  ];
  const re = /(-?\d+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) {
    if (m.index > last)
      parts.push(<SearchHitHighlightedText key={`t${last}`} text={rest.slice(last, m.index)} query={query} />);
    const widget = colorKind ? (
      <RsColorSwatch key={`sw${m.index}`} value={+m[1]} kind={colorKind} />
    ) : (
      <RsTextureSwatch key={`sw${m.index}`} value={+m[1]} />
    );
    if (enableWidgets && isArray) parts.push(widget);
    parts.push(<SearchHitHighlightedText key={`n${m.index}`} text={m[1]} query={query} />);
    if (enableWidgets && !isArray) parts.push(widget);
    last = m.index + m[1].length;
  }
  if (last < rest.length)
    parts.push(<SearchHitHighlightedText key="tend" text={rest.slice(last)} query={query} />);
  return <>{parts}</>;
}

/** High-contrast hit paint (avoid `<mark>` UA styles that can hide highlights). */
const SEARCH_HIT_MARK_CLASS =
  "rounded-[2px] px-0.5 font-mono text-xs font-normal not-italic ring-1 ring-yellow-700/70 bg-yellow-300 text-neutral-950 dark:bg-amber-400 dark:text-neutral-950 dark:ring-amber-600/80";

function SearchHitHighlightedText({ text, query }: { text: string; query: string }) {
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
              <SearchHitHighlightedText text={seg.text} query={query} />
              {swatchAfter}
            </React.Fragment>
          );
        }
        if (seg.kind === "add") {
          return (
            <React.Fragment key={i}>
              {swatchBefore}
              <span className="rounded-[2px] bg-green-500/30 dark:bg-green-500/24">
                <SearchHitHighlightedText text={seg.text} query={query} />
              </span>
              {swatchAfter}
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key={i}>
            {swatchBefore}
            <span className="rounded-[2px] bg-red-500/24 text-red-900 line-through opacity-85 dark:bg-red-500/22 dark:text-red-100">
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
              <SearchHitHighlightedText text={seg.text} query={query} />
              {swatchAfter}
            </React.Fragment>
          );
        }
        if (side === "left" && seg.kind === "remove") {
          return (
            <React.Fragment key={i}>
              {swatchBefore}
              <span className="rounded-[2px] bg-red-500/24 text-red-900 line-through opacity-85 dark:bg-red-500/22 dark:text-red-100">
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
              <span className="rounded-[2px] bg-green-500/30 dark:bg-green-500/24">
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
  if (!q) return true;
  const needle = q.toLowerCase();
  let sectionStart = 0;
  for (let k = 0; k <= i; k++) {
    if (lines[k]?.line.startsWith("// ")) sectionStart = k;
  }
  if (lines[i].line.toLowerCase().includes(needle)) return true;
  if (lines[sectionStart]?.line.toLowerCase().includes(needle)) return true;
  if (sectionStart + 1 < lines.length && lines[sectionStart + 1].line.toLowerCase().includes(needle)) return true;
  return false;
}

function bracketedSectionQuery(q: string): string | null {
  const trimmed = q.trim().toLowerCase();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]") || trimmed.length < 3) return null;
  return trimmed;
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

export function DiffConfigDiffText({ lines, filterMode, searchQuery, layout = "split" }: DiffConfigDiffTextProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportH, setViewportH] = React.useState(400);

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

  const sectionSearchHits = React.useMemo(() => {
    const exactTitleQuery = bracketedSectionQuery(searchQuery);
    const hits = new Set<number>();
    if (!exactTitleQuery) return hits;

    let sectionStart = -1;
    for (let i = 0; i <= lines.length; i++) {
      const isHeader = i < lines.length && lines[i]!.line.startsWith("// ");
      if (isHeader || i === lines.length) {
        if (sectionStart >= 0) {
          const titleIdx = sectionStart + 1;
          const titleLine = lines[titleIdx]?.line?.trim().toLowerCase();
          if (titleLine === exactTitleQuery) {
            for (let k = sectionStart; k < i; k++) hits.add(k);
          }
        }
        sectionStart = i < lines.length ? i : -1;
      }
    }
    return hits;
  }, [lines, searchQuery]);

  const lineNumbersByIndex = React.useMemo(() => {
    const out: { oldLine: number | null; newLine: number | null }[] = [];
    let oldLine = 1;
    let newLine = 1;
    for (let i = 0; i < lines.length; i++) {
      const dk = lineKindByIndex[i] ?? "context";
      if (dk === "add") {
        out[i] = { oldLine: null, newLine };
        newLine++;
      } else if (dk === "removed") {
        out[i] = { oldLine, newLine: null };
        oldLine++;
      } else {
        out[i] = { oldLine, newLine };
        oldLine++;
        newLine++;
      }
    }
    return out;
  }, [lines, lineKindByIndex]);

  const onScroll = React.useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
  }, []);

  React.useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight || 400));
    ro.observe(el);
    setViewportH(el.clientHeight || 400);
    return () => ro.disconnect();
  }, []);

  const totalH = visibleIndices.length === 0 ? 0 : visibleIndices.length * LINE_H;
  const start =
    visibleIndices.length === 0 ? 0 : Math.max(0, Math.floor(scrollTop / LINE_H) - OVERSCAN);
  const end =
    visibleIndices.length === 0
      ? -1
      : Math.min(visibleIndices.length - 1, Math.ceil((scrollTop + viewportH) / LINE_H) + OVERSCAN);
  const visibleStart = visibleIndices.length === 0 ? 0 : Math.max(0, Math.floor(scrollTop / LINE_H));
  const visibleEnd =
    visibleIndices.length === 0
      ? -1
      : Math.min(visibleIndices.length - 1, Math.ceil((scrollTop + viewportH) / LINE_H));

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
    <div
      ref={parentRef}
      className="min-h-0 flex-1 overflow-auto rounded-md border bg-background"
      onScroll={onScroll}
    >
      <div className="relative min-h-[8rem] font-mono text-xs" style={{ height: Math.max(totalH, 120) }}>
        {visibleIndices.length === 0 ? (
          <div className="p-4 text-muted-foreground">No lines match the current filter and search.</div>
        ) : null}
        {visibleIndices.length > 0 && end >= start
          ? Array.from({ length: end - start + 1 }, (_, k) => start + k)
              .filter((vi) => vi >= 0 && vi < visibleIndices.length)
              .map((vi) => {
              const widgetsInView = vi >= visibleStart && vi <= visibleEnd;
              const lineIndex = visibleIndices[vi];
              const row = lines[lineIndex];
              const beforeDisplay = withFieldPrefixIfMissing(row.before, row.line || " ");
              const inSection = inConfigSectionBlock(blocks, lineIndex);
              const lineTip = tooltipBody(row, inSection);
              const dk = lineKindByIndex[lineIndex] ?? "context";
              const barColor =
                dk === "add"
                  ? "bg-green-500"
                  : dk === "change"
                    ? "bg-amber-500"
                    : dk === "removed"
                      ? "bg-red-500"
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

              const iconWrap = "flex h-full w-5 shrink-0 items-center justify-center font-semibold";
              const lineMarker =
                dk === "add" ? (
                  <span className={cn(iconWrap, "text-green-700 dark:text-green-400")} aria-label="Added line">
                    +
                  </span>
                ) : dk === "removed" ? (
                  <span className={cn(iconWrap, "text-red-700 dark:text-red-400")} aria-label="Removed line">
                    -
                  </span>
                ) : dk === "change" ? (
                  <span className={cn(iconWrap, "text-amber-700 dark:text-amber-400")} aria-label="Changed line">
                    ~
                  </span>
                ) : (
                  <span className={cn(iconWrap, "opacity-0")} aria-hidden>
                    .
                  </span>
                );

              const showBlockRangeTip = Boolean(lineTooltipBody && blockInfo?.isFirst);

              const gutterIcon = showBlockRangeTip ? (
                <Tooltip key={`ic-${lineIndex}`}>
                  <TooltipTrigger render={<span className="inline-flex">{lineMarker}</span>} />
                  <TooltipContent
                    opaque
                    side="right"
                    className="max-w-sm border border-zinc-800 bg-zinc-950 p-3 text-xs text-white"
                  >
                    {lineTooltipBody}
                  </TooltipContent>
                </Tooltip>
              ) : (
                lineMarker
              );

              const gutterCell = (
                <div className="flex h-full items-center font-mono text-[11px]">
                  <span className="flex w-6 shrink-0 items-center justify-end pr-1.5 text-right tabular-nums text-muted-foreground">
                    {lineIndex + 1}
                  </span>
                  <span className={cn("w-1 shrink-0 self-stretch rounded-sm", barColor ?? "bg-transparent")} />
                  {gutterIcon}
                </div>
              );

              const lineInner = (
                <span
                  className={cn(
                    "block w-full min-w-0 cursor-default whitespace-pre px-3 py-0",
                    dk === "add" && "bg-green-500/35 dark:bg-green-500/28",
                    dk === "change" && "bg-amber-500/35 dark:bg-amber-500/28",
                    dk === "removed" && "bg-red-500/35 dark:bg-red-500/28",
                  )}
                >
                  {dk === "change" && typeof row.before === "string" ? (
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
                    ? "border-green-600/70 bg-green-500/15 dark:border-green-500/60 dark:bg-green-500/10"
                    : "border-red-600/70 bg-red-500/15 dark:border-red-500/60 dark:bg-red-500/10";
                const wrapperClass = cn(
                  "ml-2 mr-1 min-h-full w-full min-w-0 overflow-hidden",
                  blockInfo.isFirst && "mt-1 rounded-t-lg border-x border-t",
                  blockInfo.isLast && "mb-1 rounded-b-lg border-x border-b",
                  !blockInfo.isFirst && !blockInfo.isLast && "border-x",
                );
                content = <div className={cn(wrapperClass, blockClass)}>{lineInner}</div>;
              } else {
                content = wrapTooltip(lineInner, lineTip, `ln-${lineIndex}`);
              }

              const sectionSearchTint = sectionSearchHits.has(lineIndex)
                ? "ring-1 ring-inset ring-yellow-600/40 bg-yellow-200/10 dark:ring-yellow-400/30 dark:bg-yellow-300/10"
                : "";

              const rowTint =
                dk === "add"
                  ? cn("bg-green-500/10 dark:bg-green-500/14", sectionSearchTint)
                  : dk === "removed"
                    ? cn("bg-red-500/10 dark:bg-red-500/14", sectionSearchTint)
                    : dk === "change"
                      ? cn("bg-amber-500/12 dark:bg-amber-500/16", sectionSearchTint)
                      : sectionSearchTint;

              const top = vi * LINE_H;

              if (layout === "split") {
                const nums = lineNumbersByIndex[lineIndex] ?? { oldLine: null, newLine: null };
                const hasBefore = typeof row.before === "string";
                const splitTip = showBlockRangeTip ? lineTooltipBody : lineTip;

                const leftContent =
                  dk === "add"
                    ? ""
                    : dk === "change" && hasBefore
                      ? (beforeDisplay ?? row.before!)
                      : row.line || " ";

                const rightContent = dk === "removed" ? "" : row.line || " ";

                const leftNode =
                  dk === "change" && hasBefore ? (
                    <ChangedSideText
                      before={beforeDisplay ?? row.before!}
                      after={row.line || " "}
                      query={searchQuery}
                      side="left"
                      enableWidgets={widgetsInView}
                    />
                  ) : (
                    <ColorLineText text={leftContent} query={searchQuery} enableWidgets={widgetsInView} />
                  );

                const rightNode =
                  dk === "change" && hasBefore ? (
                    <ChangedSideText
                      before={beforeDisplay ?? row.before!}
                      after={row.line || " "}
                      query={searchQuery}
                      side="right"
                      enableWidgets={widgetsInView}
                    />
                  ) : (
                    <ColorLineText text={rightContent} query={searchQuery} enableWidgets={widgetsInView} />
                  );

                const leftBg =
                  dk === "removed" || dk === "change"
                    ? "bg-red-500/16 dark:bg-red-500/14"
                    : "bg-transparent";
                const rightBg =
                  dk === "add" || dk === "change"
                    ? "bg-green-500/16 dark:bg-green-500/14"
                    : "bg-transparent";

                const leftMarker = dk === "removed" || dk === "change" ? "-" : " ";
                const rightMarker = dk === "add" || dk === "change" ? "+" : " ";

                const splitMarker = (
                  marker: string,
                  className: string,
                  side: "left" | "right",
                ) => {
                  const node = <span className={className}>{marker}</span>;
                  if (marker.trim() === "" || !splitTip) return node;
                  return (
                    <Tooltip>
                      <TooltipTrigger render={node} />
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
                    style={{ top, height: LINE_H }}
                  >
                    <div className="flex min-w-0 flex-1 border-r border-border/40">
                      <div className="flex w-14 shrink-0 items-center justify-end border-r bg-muted/35 pr-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {nums.oldLine ?? ""}
                      </div>
                      <div className="flex w-6 shrink-0 items-center justify-center border-r bg-muted/25 font-mono text-[11px] text-red-700 dark:text-red-400">
                        {splitMarker(
                          leftMarker,
                          "flex h-full w-full items-center justify-center",
                          "left",
                        )}
                      </div>
                      <div className={cn("min-w-0 flex-1 overflow-hidden px-3 py-0 font-mono text-xs leading-[22px]", leftBg)}>
                        {leftNode}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1">
                      <div className="flex w-14 shrink-0 items-center justify-end border-r bg-muted/35 pr-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {nums.newLine ?? ""}
                      </div>
                      <div className="flex w-6 shrink-0 items-center justify-center border-r bg-muted/25 font-mono text-[11px] text-green-700 dark:text-green-400">
                        {splitMarker(
                          rightMarker,
                          "flex h-full w-full items-center justify-center",
                          "right",
                        )}
                      </div>
                      <div className={cn("min-w-0 flex-1 overflow-hidden px-3 py-0 font-mono text-xs leading-[22px]", rightBg)}>
                        {rightNode}
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
                  style={{ top, height: LINE_H }}
                >
                  <div className="shrink-0 border-r bg-muted/40" style={{ width: 72 }}>
                    {wrapTooltip(gutterCell, blockInfo && !showBlockRangeTip ? null : !blockInfo ? lineTip : null, `g-${lineIndex}`)}
                  </div>
                  <div className="min-w-0 flex-1 border-b border-border/40">{content}</div>
                </div>
              );
            })
          : null}
      </div>
    </div>
  );
}
