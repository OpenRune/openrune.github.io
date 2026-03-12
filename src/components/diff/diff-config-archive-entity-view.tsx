"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCacheType } from "@/context/cache-type-context";
import type { GamevalExtraData, GamevalType } from "@/context/gameval-context";
import {
  IFTYPES,
  INVTYPES,
  ITEMTYPES,
  NPCTYPES,
  OBJTYPES,
  ROWTYPES,
  SEQTYPES,
  SOUNDTYPES,
  SPOTTYPES,
  SPRITETYPES,
  TABLETYPES,
  VARBITTYPES,
  VARCSTYPES,
  VARPTYPES,
  useGamevals,
} from "@/context/gameval-context";
import type { AppSettings } from "@/context/settings-context";
import { cacheProxyHeaders, diffSpriteResolveUrl } from "@/lib/cache-proxy-client";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";
import { cn } from "@/lib/utils";
import { RsColorBox } from "@/components/ui/rs-color-box";
import { RSSprite } from "@/components/ui/RSSprite";
import { RSTexture } from "@/components/ui/RSTexture";

import { DiffConfigArchiveView } from "./diff-config-archive-view";
import type { ConfigArchiveTableRow, DiffConfigArchiveTextLineProps } from "./diff-config-archive-types";
import { GAMEVAL_MIN_REVISION } from "./diff-constants";
import { configLinesFromCachePayload } from "./diff-config-content";
import type { DiffMode, DiffSearchFieldMode } from "./diff-types";
import type { ConfigLine } from "./diff-types";
import {
  openruneColumnHeaderLabel,
  openruneEntityArchiveColumnKeys,
} from "./diff-openrune-archive-columns";
import type { ArchiveEntitySection } from "./diff-openrune-archive-columns";
import {
  OpenRuneArchiveTableCell,
  OpenRuneItemImage,
  OpenRuneNpcImage,
} from "./diff-openrune-archive-table-cell";
import { DIFF_ARCHIVE_TABLE_CELL_CLASS, DIFF_ARCHIVE_TABLE_HEAD_CLASS } from "./diff-table-archive-styles";
import { useSpotanimSequenceTicks } from "./diff-spotanim-sequence-ticks";

export { ARCHIVE_ENTITY_SECTIONS, isArchiveEntitySection } from "./diff-openrune-archive-columns";
export type { ArchiveEntitySection } from "./diff-openrune-archive-columns";

const TABLE_BASE = 1;
const GAMEVAL_BULK_PAGE = 500;
const TEXT_LINE_HEIGHT = 28;

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

function RsTextureSwatch({ value, combinedRev }: { value: number; combinedRev: number }) {
  return (
    <span className="mx-1.5 inline-block align-middle" style={{ lineHeight: 0 }}>
      <RSTexture
        textureDefinitionId={value}
        combinedDiffSprite
        rev={combinedRev}
        width={12}
        height={12}
        fitMax
        keepAspectRatio
        className="rounded-[2px]"
        enableClickModel
      />
    </span>
  );
}

type HighlightSeg = { text: string; highlight: boolean };

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

function splitHighlightRegex(text: string, patternRaw: string): HighlightSeg[] | null {
  const pattern = patternRaw.trim();
  if (!pattern) return [{ text, highlight: false }];
  let re: RegExp;
  try {
    re = new RegExp(pattern, "gi");
  } catch {
    return null;
  }
  const out: HighlightSeg[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index;
    if (idx === undefined || m[0].length === 0) continue;
    if (idx < last) continue;
    if (idx > last) out.push({ text: text.slice(last, idx), highlight: false });
    out.push({ text: m[0], highlight: true });
    last = idx + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), highlight: false });
  if (out.length === 0) return [{ text, highlight: false }];
  return out;
}

const FIND_MARK_CLASS =
  "rounded-[2px] bg-yellow-300/90 px-0.5 font-mono text-sm font-normal not-italic text-foreground dark:bg-yellow-500/45";

const INLINE_GAMEVAL_REF_REGEX = /\b([a-z][a-z0-9_]*)\.([A-Za-z0-9_:$\/-]+)\b/gi;
const INLINE_GAMEVAL_BUTTON_CLASS =
  "cursor-pointer rounded-[2px] px-0.5 text-sky-700 underline decoration-sky-500/55 underline-offset-2 transition-colors hover:bg-sky-500/10 hover:text-sky-900 dark:text-sky-300 dark:hover:bg-sky-500/15 dark:hover:text-sky-100";

const TABLE_GAMEVAL_BUTTON_CLASS =
  "cursor-pointer rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-xs font-mono text-sky-800 transition-colors hover:bg-sky-500/20 hover:border-sky-500/60 dark:text-sky-200 dark:hover:bg-sky-500/20";

const INLINE_GAMEVAL_GROUP_TO_TYPE: Record<string, GamevalType> = {
  items: ITEMTYPES,
  itemtypes: ITEMTYPES,
  npcs: NPCTYPES,
  npctypes: NPCTYPES,
  inv: INVTYPES,
  invtypes: INVTYPES,
  objects: OBJTYPES,
  objtypes: OBJTYPES,
  sequences: SEQTYPES,
  seqtypes: SEQTYPES,
  spotanim: SPOTTYPES,
  spotanims: SPOTTYPES,
  spottypes: SPOTTYPES,
  sprites: SPRITETYPES,
  spritetypes: SPRITETYPES,
  varp: VARPTYPES,
  varptypes: VARPTYPES,
  varbits: VARBITTYPES,
  varbittypes: VARBITTYPES,
  varcs: VARCSTYPES,
  rowtypes: ROWTYPES,
  dbrows: ROWTYPES,
  dbtables: TABLETYPES,
  tabletypes: TABLETYPES,
  interfaces: IFTYPES,
  iftypes: IFTYPES,
  jingles: SOUNDTYPES,
  soundtypes: SOUNDTYPES,
};

type InlineGamevalReference = {
  type: GamevalType;
  group: string;
  name: string;
  raw: string;
};

function findInlineGamevalReferences(text: string): InlineGamevalReference[] {
  const out: InlineGamevalReference[] = [];
  INLINE_GAMEVAL_REF_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_GAMEVAL_REF_REGEX.exec(text)) !== null) {
    const group = match[1]?.toLowerCase() ?? "";
    const type = INLINE_GAMEVAL_GROUP_TO_TYPE[group];
    if (!type) continue;
    out.push({
      type,
      group,
      name: match[2] ?? "",
      raw: match[0] ?? "",
    });
  }
  return out;
}

function configTypeForGamevalType(type: GamevalType): string | null {
  switch (type) {
    case ITEMTYPES:
      return "items";
    case NPCTYPES:
      return "npcs";
    case INVTYPES:
      return "inv";
    case OBJTYPES:
      return "objects";
    case SEQTYPES:
      return "sequences";
    case SPOTTYPES:
      return "spotanims";
    case VARPTYPES:
      return "varp";
    case VARBITTYPES:
      return "varbits";
    case VARCSTYPES:
      return "varcs";
    case ROWTYPES:
      return "dbrows";
    case TABLETYPES:
      return "dbtables";
    case SOUNDTYPES:
      return "jingles";
    case SPRITETYPES:
      return "sprites";
    case IFTYPES:
      return "components";
    default:
      return null;
  }
}

function GamevalReferenceDialog({
  combinedRev,
  openRef,
  onOpenChange,
  lookupGameval,
  getGamevalExtra,
}: {
  combinedRev: number;
  openRef: { ref: InlineGamevalReference; id: number } | null;
  onOpenChange: (open: boolean) => void;
  lookupGameval: (type: GamevalType, id: number, rev?: number | "latest") => string | undefined;
  getGamevalExtra: (type: GamevalType, id: number, rev?: number | "latest") => GamevalExtraData | undefined;
}) {
  const { selectedCacheType } = useCacheType();
  const [configLines, setConfigLines] = React.useState<ConfigLine[] | null>(null);
  const [configStatus, setConfigStatus] = React.useState<"idle" | "loading" | "ok" | "error">("idle");
  const [configError, setConfigError] = React.useState<string | null>(null);
  // Keep last non-null ref so dialog content stays visible during the close animation.
  const lastOpenRef = React.useRef(openRef);
  if (openRef != null) lastOpenRef.current = openRef;
  const displayRef = openRef ?? lastOpenRef.current;
  const isSpriteRef = displayRef?.ref.type === SPRITETYPES;
  const isItemRef = displayRef?.ref.type === ITEMTYPES;
  const isNpcRef = displayRef?.ref.type === NPCTYPES;
  const spritePreviewUrl =
    isSpriteRef && displayRef ? diffSpriteResolveUrl(displayRef.id, { base: TABLE_BASE, rev: combinedRev }) : null;
  const extra = displayRef ? getGamevalExtra(displayRef.ref.type, displayRef.id, combinedRev) : undefined;
  const displayName = displayRef ? (lookupGameval(displayRef.ref.type, displayRef.id, combinedRev) ?? displayRef.ref.name) : "";
  const subEntries = React.useMemo(
    () =>
      Object.entries(extra?.sub ?? {})
        .map(([key, value]) => ({ id: Number.parseInt(key, 10), value }))
        .filter((entry) => Number.isFinite(entry.id))
        .sort((a, b) => a.id - b.id),
    [extra],
  );

  React.useEffect(() => {
    // Don't clear state on close — keep previous data visible during exit animation.
    if (!openRef) return;

    if (openRef.ref.type === SPRITETYPES) {
      setConfigLines(null);
      setConfigStatus("idle");
      setConfigError(null);
      return;
    }

    const configType = configTypeForGamevalType(openRef.ref.type);
    if (!configType) {
      setConfigLines(null);
      setConfigStatus("error");
      setConfigError(`No config preview available for ${openRef.ref.type}`);
      return;
    }

    let cancelled = false;
    setConfigStatus("loading");
    setConfigError(null);

    const params = new URLSearchParams({
      type: configType === "spotanim" ? "spotanims" : configType,
      id: String(openRef.id),
      rev: String(combinedRev),
    });
    const url = `/api/cache-proxy/cache?${params.toString()}`;
    const cacheKey = `cache:config:dialog:${selectedCacheType.id}:${configType}:${openRef.id}:${combinedRev}`;

    const run = async () => {
      try {
        const { data } = await conditionalJsonFetch<unknown>(cacheKey, url, {
          headers: cacheProxyHeaders(selectedCacheType),
        });
        if (cancelled) return;
        const lines = configLinesFromCachePayload(data, configType, {
          headerLabelForId: (id) => lookupGameval(openRef.ref.type, id, combinedRev),
          includeCommentWithoutHeaderLabel: true,
        });
        setConfigLines(lines ?? []);
        setConfigStatus("ok");
      } catch (error) {
        if (cancelled) return;
        setConfigLines(null);
        setConfigStatus("error");
        setConfigError(error instanceof Error ? error.message : `Failed to load ${configType} ${openRef.id}`);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [openRef, combinedRev, selectedCacheType, lookupGameval]);

  return (
    <Dialog open={openRef != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            {displayRef && (isItemRef || isNpcRef) ? (
              <div className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded border border-border/60 bg-background/90 p-1">
                {isItemRef ? <OpenRuneItemImage id={displayRef.id} /> : <OpenRuneNpcImage id={displayRef.id} />}
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <DialogTitle>{displayRef ? displayRef.ref.raw : "Gameval"}</DialogTitle>
              <DialogDescription>
                {displayRef ? `${displayRef.ref.type} · ID ${displayRef.id} · rev ${combinedRev}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {displayRef ? (
          <div className="grid gap-4 text-sm">
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              <span className="font-mono text-foreground">{displayName || displayRef?.ref.name}</span>
              {extra?.searchable && extra.searchable !== displayName ? (
                <span className="ml-3 font-mono">searchable={extra.searchable}</span>
              ) : null}
            </div>

            {isSpriteRef ? (
              <div className="flex justify-center rounded-md border border-border/60 bg-background/90 p-6">
                <RSSprite
                  id={displayRef.id}
                  rev={combinedRev}
                  gameval={displayName || displayRef.ref.name}
                  gamevalRevision={combinedRev}
                  imageUrl={spritePreviewUrl ?? undefined}
                  fullSizeImageUrl={spritePreviewUrl ?? undefined}
                  width={128}
                  height={128}
                  keepAspectRatio
                  fitMax
                  rounded
                  className="rounded-md"
                />
              </div>
            ) : configStatus === "loading" ? (
              <div className="rounded-md border border-border/60 bg-background/80 p-4">
                <div className="space-y-2">
                  {Array.from({ length: 10 }, (_, i) => (
                    <Skeleton key={i} className="h-4 w-full" delayMs={i * 20} shimmer={false} />
                  ))}
                </div>
              </div>
            ) : configStatus === "error" ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {configError}
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-auto rounded-md border border-border/60 bg-background/90">
                <div className="p-3 font-mono text-xs leading-6 text-foreground">
                  {(configLines ?? []).map((entry, index) => (
                    <div key={`${index}-${entry.line}`} className="whitespace-pre-wrap break-words">
                      {entry.line || " "}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {configStatus !== "ok" && subEntries.length > 0 ? (
              <div className="grid gap-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Sub values</div>
                <div className="max-h-64 overflow-auto rounded-md border border-border/60 bg-background/80">
                  <div className="divide-y divide-border/50">
                    {subEntries.map((entry) => (
                      <div key={entry.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 px-3 py-2 text-xs">
                        <span className="font-mono text-muted-foreground">{entry.id}</span>
                        <span className="font-mono break-words text-foreground">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const FindHighlightedText = React.memo(function FindHighlightedText({
  text,
  kind,
  query,
  enabled,
}: {
  text: string;
  kind: "literal" | "regex";
  query: string;
  enabled: boolean;
}) {
  if (!enabled || !query.trim()) {
    return <>{text}</>;
  }
  const segs = kind === "literal" ? splitHighlightLiteral(text, query) : splitHighlightRegex(text, query);
  const list = segs ?? [{ text, highlight: false }];
  return (
    <>
      {list.map((seg, i) =>
        seg.highlight ? (
          <mark key={i} className={FIND_MARK_CLASS}>
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
});

/** Shared by entity archive views and the combined gamevals explorer text mode. */
export const ArchivePlainTextLine = React.memo(function ArchivePlainTextLine({
  line,
  combinedRev: _combinedRev,
  hoverText,
  showInline: _showInline,
  findKind,
  findQuery,
  findMarkActive,
}: DiffConfigArchiveTextLineProps) {
  const { loadGamevalType, hasLoaded, lookupGameval, lookupGamevalByName, getGamevalExtra } = useGamevals();
  const [openRef, setOpenRef] = React.useState<{ ref: InlineGamevalReference; id: number } | null>(null);
  const hl =
    findMarkActive && findQuery?.trim()
      ? { kind: findKind ?? "literal", query: findQuery.trim(), active: true as const }
      : null;

  const inlineRefTypes = React.useMemo(() => {
    const types = new Set<GamevalType>();
    for (const ref of findInlineGamevalReferences(line)) {
      types.add(ref.type);
    }
    return [...types];
  }, [line]);

  React.useEffect(() => {
    for (const type of inlineRefTypes) {
      if (!hasLoaded(type, _combinedRev)) {
        void loadGamevalType(type, _combinedRev);
      }
    }
  }, [inlineRefTypes, hasLoaded, loadGamevalType, _combinedRev]);

  const splitHoverTarget = (rawLine: string): { prefix: string; value: string } | null => {
    const firstEq = rawLine.indexOf("=");
    if (firstEq <= 0) return null;
    const paramMatch = /^param=parm_\d+=/.exec(rawLine);
    if (paramMatch) {
      const secondEq = rawLine.indexOf("=", firstEq + 1);
      if (secondEq > firstEq) {
        return { prefix: rawLine.slice(0, secondEq + 1), value: rawLine.slice(secondEq + 1) || " " };
      }
    }
    return { prefix: rawLine.slice(0, firstEq + 1), value: rawLine.slice(firstEq + 1) || " " };
  };

  const resolveHoverTextId = (baseHoverText: string, value: string): string => {
    if (!baseHoverText) return baseHoverText;
    // If an id line is already present, don't add another.
    if (/^id:/m.test(baseHoverText)) return baseHoverText;
    const tokenMatch = /^([a-z0-9_]+)\.([A-Za-z0-9_:$\/-]+)/i.exec(value.trim());
    if (!tokenMatch) return baseHoverText;
    const group = tokenMatch[1]?.toLowerCase() ?? "";
    const name = tokenMatch[2] ?? "";
    const type = INLINE_GAMEVAL_GROUP_TO_TYPE[group];
    if (!type) return baseHoverText;
    const id = lookupGamevalByName(type, name, _combinedRev);
    if (id == null) return baseHoverText;
    return `${baseHoverText}\nid: ${id}`;
  };

  const wrapHoverValue = (node: React.ReactNode, tooltipOverride?: string) => {
    const tip = tooltipOverride ?? hoverText;
    if (!tip?.trim()) return node;
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="inline-flex h-[18px] items-center whitespace-pre rounded border border-sky-500/45 bg-sky-500/10 px-1 text-sky-900 shadow-sm transition-colors hover:bg-sky-500/20 dark:text-sky-100 cursor-help align-middle leading-none">
              {node}
            </span>
          }
        />
        <TooltipContent
          opaque
          side="top"
          className="max-w-sm whitespace-pre-line border border-zinc-800 bg-zinc-950 p-2 text-xs text-white"
        >
          {tip}
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderTextWithInlineGamevals = React.useCallback(
    (text: string) => {
      if (findInlineGamevalReferences(text).length === 0) {
        return (
          <FindHighlightedText
            text={text || " "}
            kind={hl?.kind ?? "literal"}
            query={hl?.query ?? ""}
            enabled={Boolean(hl)}
          />
        );
      }

      const nodes: React.ReactNode[] = [];
      let cursor = 0;
      INLINE_GAMEVAL_REF_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = INLINE_GAMEVAL_REF_REGEX.exec(text)) !== null) {
        const raw = match[0] ?? "";
        const start = match.index;
        const end = start + raw.length;
        const group = match[1]?.toLowerCase() ?? "";
        const type = INLINE_GAMEVAL_GROUP_TO_TYPE[group];
        if (!type) continue;
        if (start > cursor) {
          nodes.push(
            <FindHighlightedText
              key={`plain-${cursor}`}
              text={text.slice(cursor, start)}
              kind={hl?.kind ?? "literal"}
              query={hl?.query ?? ""}
              enabled={Boolean(hl)}
            />, 
          );
        }

        const name = match[2] ?? "";
        const id = lookupGamevalByName(type, name, _combinedRev);
        if (id == null) {
          nodes.push(
            <FindHighlightedText
              key={`ref-${start}`}
              text={raw}
              kind={hl?.kind ?? "literal"}
              query={hl?.query ?? ""}
              enabled={Boolean(hl)}
            />,
          );
        } else {
          nodes.push(
            <button
              key={`ref-${start}`}
              type="button"
              className={INLINE_GAMEVAL_BUTTON_CLASS}
              onClick={() => setOpenRef({ ref: { type, group, name, raw }, id })}
              title={`Open ${raw}`}
            >
              <FindHighlightedText
                text={raw}
                kind={hl?.kind ?? "literal"}
                query={hl?.query ?? ""}
                enabled={Boolean(hl)}
              />
            </button>,
          );
        }
        cursor = end;
      }
      if (cursor < text.length) {
        nodes.push(
          <FindHighlightedText
            key={`plain-tail-${cursor}`}
            text={text.slice(cursor)}
            kind={hl?.kind ?? "literal"}
            query={hl?.query ?? ""}
            enabled={Boolean(hl)}
          />, 
        );
      }
      return <>{nodes}</>;
    },
    [hl?.kind, hl?.query, lookupGamevalByName, _combinedRev],
  );

  const fn = getFieldName(line);
  if (fn && (getColorFieldType(fn) || isTextureField(fn))) {
    const colorKind = getColorFieldType(fn);
    const textureField = isTextureField(fn);
    const displayLine = displayTextureFieldLine(line);
    const eqIdx = displayLine.indexOf("=");
    const prefix = displayLine.slice(0, eqIdx + 1);
    const rest = displayLine.slice(eqIdx + 1);
    const hlKind = hl?.kind ?? "literal";
    const hlQuery = hl?.query ?? "";
    const hlEnabled = Boolean(hl);
    const isArray = isArrayValue(rest);
    const valueParts: React.ReactNode[] = [];
    const re = /(-?\d+)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest)) !== null) {
      if (m.index > last)
        valueParts.push(
          <FindHighlightedText
            key={`t${last}`}
            text={rest.slice(last, m.index)}
            kind={hlKind}
            query={hlQuery}
            enabled={hlEnabled}
          />,
        );
      const widget = colorKind ? (
        <RsColorSwatch key={`sw${m.index}`} value={+m[1]} kind={colorKind} />
      ) : textureField ? (
        <RsTextureSwatch key={`sw${m.index}`} value={+m[1]} combinedRev={_combinedRev} />
      ) : null;
      if (isArray && widget) valueParts.push(widget);
      valueParts.push(
        <FindHighlightedText key={`n${m.index}`} text={m[1]} kind={hlKind} query={hlQuery} enabled={hlEnabled} />,
      );
      if (!isArray && widget) valueParts.push(widget);
      last = m.index + m[1].length;
    }
    if (last < rest.length)
      valueParts.push(
        <FindHighlightedText key="tend" text={rest.slice(last)} kind={hlKind} query={hlQuery} enabled={hlEnabled} />,
      );
    return (
      <>
        <span className="whitespace-pre">
          <FindHighlightedText key="pfx" text={prefix} kind={hlKind} query={hlQuery} enabled={hlEnabled} />
          {wrapHoverValue(<>{valueParts}</>)}
        </span>
        <GamevalReferenceDialog
          combinedRev={_combinedRev}
          openRef={openRef}
          onOpenChange={(open) => {
            if (!open) setOpenRef(null);
          }}
          lookupGameval={lookupGameval}
          getGamevalExtra={getGamevalExtra}
        />
      </>
    );
  }

  const split = splitHoverTarget(line);
  if (split && hoverText?.trim()) {
    const countSuffixMatch = /,count=\d+$/i.exec(split.value);
    const mainValue = countSuffixMatch ? split.value.slice(0, split.value.length - countSuffixMatch[0].length) : split.value;
    const countSuffix = countSuffixMatch ? countSuffixMatch[0] : "";
    return (
      <>
        <span className="whitespace-pre">
          <FindHighlightedText
            text={split.prefix}
            kind={hl?.kind ?? "literal"}
            query={hl?.query ?? ""}
            enabled={Boolean(hl)}
          />
          {wrapHoverValue(renderTextWithInlineGamevals(mainValue), resolveHoverTextId(hoverText ?? "", mainValue))}
          {countSuffix && (
            <FindHighlightedText
              text={countSuffix}
              kind={hl?.kind ?? "literal"}
              query={hl?.query ?? ""}
              enabled={Boolean(hl)}
            />
          )}
        </span>
        <GamevalReferenceDialog
          combinedRev={_combinedRev}
          openRef={openRef}
          onOpenChange={(open) => {
            if (!open) setOpenRef(null);
          }}
          lookupGameval={lookupGameval}
          getGamevalExtra={getGamevalExtra}
        />
      </>
    );
  }

  return (
    <>
      <span className="whitespace-pre">{renderTextWithInlineGamevals(line || " ")}</span>
      <GamevalReferenceDialog
        combinedRev={_combinedRev}
        openRef={openRef}
        onOpenChange={(open) => {
          if (!open) setOpenRef(null);
        }}
        lookupGameval={lookupGameval}
        getGamevalExtra={getGamevalExtra}
      />
    </>
  );
});

type EntityMeta = {
  title: string;
  tableEntitySingular: string;
  tableEntityPlural: string;
  paginationCountLabel: string;
  emptyTableMessage: string;
  decodingMessage: string;
  tableErrorVerb: string;
  contentErrorVerb: string;
  gamevalFilterErrorVerb: string;
  searchHint: string;
  gamevalType: GamevalType | null;
  suggestionEnabled: (d: AppSettings["suggestionDisplay"]) => boolean;
};

const ENTITY_META: Record<ArchiveEntitySection, EntityMeta> = {
  items: {
    title: "Items",
    tableEntitySingular: "item",
    tableEntityPlural: "items",
    paginationCountLabel: "items",
    emptyTableMessage: "No item rows for this revision (or no matches).",
    decodingMessage: "Item data is still decoding on the cache server. Try again in a moment.",
    tableErrorVerb: "load items table",
    contentErrorVerb: "load items content",
    gamevalFilterErrorVerb: "filter items by gameval",
    searchHint: "Items: ID, gameval (items), name substring, or regex.",
    gamevalType: ITEMTYPES,
    suggestionEnabled: (d) => d.items,
  },
  npcs: {
    title: "NPCs",
    tableEntitySingular: "NPC",
    tableEntityPlural: "NPCs",
    paginationCountLabel: "NPCs",
    emptyTableMessage: "No NPC rows for this revision (or no matches).",
    decodingMessage: "NPC data is still decoding on the cache server. Try again in a moment.",
    tableErrorVerb: "load NPCs table",
    contentErrorVerb: "load NPCs content",
    gamevalFilterErrorVerb: "filter NPCs by gameval",
    searchHint: "NPCs: ID, gameval (npcs), name substring, or regex.",
    gamevalType: NPCTYPES,
    suggestionEnabled: (d) => d.npcs,
  },
  sequences: {
    title: "Sequences",
    tableEntitySingular: "sequence",
    tableEntityPlural: "sequences",
    paginationCountLabel: "sequences",
    emptyTableMessage: "No sequence rows for this revision (or no matches).",
    decodingMessage: "Sequence data is still decoding on the cache server. Try again in a moment.",
    tableErrorVerb: "load sequences table",
    contentErrorVerb: "load sequences content",
    gamevalFilterErrorVerb: "filter sequences by gameval",
    searchHint: "Sequences: use ID or Gameval (sequences) only.",
    gamevalType: SEQTYPES,
    suggestionEnabled: (d) => d.sequences,
  },
  spotanim: {
    title: "Spot animations",
    tableEntitySingular: "spot animation",
    tableEntityPlural: "spot animations",
    paginationCountLabel: "spot animations",
    emptyTableMessage: "No spot animation rows for this revision (or no matches).",
    decodingMessage: "Spot animation data is still decoding on the cache server. Try again in a moment.",
    tableErrorVerb: "load spot animations table",
    contentErrorVerb: "load spot animations content",
    gamevalFilterErrorVerb: "filter spot animations by gameval",
    searchHint: "Spot anims: use ID or Gameval (spotanims) only.",
    gamevalType: SPOTTYPES,
    suggestionEnabled: (d) => d.spotanims,
  },
  overlay: {
    title: "Overlays",
    tableEntitySingular: "overlay",
    tableEntityPlural: "overlays",
    paginationCountLabel: "overlays",
    emptyTableMessage: "No overlay rows for this revision (or no matches).",
    decodingMessage: "Overlay data is still decoding on the cache server. Try again in a moment.",
    tableErrorVerb: "load overlays table",
    contentErrorVerb: "load overlays content",
    gamevalFilterErrorVerb: "filter overlays",
    searchHint: "Overlays: no enum gameval column — use ID, name, or regex.",
    gamevalType: null,
    suggestionEnabled: () => false,
  },
  underlay: {
    title: "Underlays",
    tableEntitySingular: "underlay",
    tableEntityPlural: "underlays",
    paginationCountLabel: "underlays",
    emptyTableMessage: "No underlay rows for this revision (or no matches).",
    decodingMessage: "Underlay data is still decoding on the cache server. Try again in a moment.",
    tableErrorVerb: "load underlays table",
    contentErrorVerb: "load underlays content",
    gamevalFilterErrorVerb: "filter underlays",
    searchHint: "Underlays: no enum gameval column — use ID, name, or regex.",
    gamevalType: null,
    suggestionEnabled: () => false,
  },
};

export type DiffConfigArchiveEntityViewProps = {
  section: ArchiveEntitySection;
  diffViewMode: DiffMode;
  combinedRev: number;
  baseRev: number;
  rev: number;
};

export function DiffConfigArchiveEntityView({
  section,
  diffViewMode,
  combinedRev,
  baseRev,
  rev,
}: DiffConfigArchiveEntityViewProps) {
  const meta = ENTITY_META[section];
  const { lookupGameval, lookupGamevalByName, loadGamevalType, hasLoaded, getGamevalExtra } = useGamevals();
  const useGamevalColumn = meta.gamevalType != null;
  const showImageCol = section === "items" || section === "npcs";

  const [openRef, setOpenRef] = React.useState<{ ref: InlineGamevalReference; id: number } | null>(null);

  const spotanimSequenceTicksById = useSpotanimSequenceTicks(
    section === "spotanim",
    TABLE_BASE,
    combinedRev,
  );

  // Pre-load sequences gameval so animationId names like "sequences.some_anim" can be resolved to numeric IDs.
  React.useEffect(() => {
    if (section !== "spotanim") return;
    if (!hasLoaded(SEQTYPES, combinedRev)) {
      void loadGamevalType(SEQTYPES, combinedRev);
    }
  }, [section, combinedRev, hasLoaded, loadGamevalType]);

  const rowEntriesForCell = React.useCallback(
    (row: ConfigArchiveTableRow): Record<string, string> => {
      if (section === "sequences") {
        return {
          ...row.entries,
          tickDuration: row.entries.lengthInCycles ?? row.entries.tickDuration ?? "",
        };
      }
      if (section === "spotanim") {
        const animationIdRaw = row.entries.animationId;
        let animationId = Number.NaN;
        if (animationIdRaw != null && animationIdRaw !== "") {
          const asNum = Number(animationIdRaw);
          if (Number.isFinite(asNum)) {
            animationId = asNum;
          } else {
            // Server renders animationId as "sequences.name" — extract the name and resolve to numeric id.
            const nameOnly = animationIdRaw.includes(".")
              ? animationIdRaw.slice(animationIdRaw.lastIndexOf(".") + 1)
              : animationIdRaw;
            const resolved = lookupGamevalByName(SEQTYPES, nameOnly, combinedRev);
            if (resolved != null) animationId = resolved;
          }
        }
        const tickFromSeq = Number.isFinite(animationId) ? spotanimSequenceTicksById[animationId] : undefined;
        const fallback = row.entries.lengthInCycles ?? row.entries.tickDuration ?? "";
        return {
          ...row.entries,
          tickDuration: tickFromSeq != null ? String(tickFromSeq) : fallback,
        };
      }
      return row.entries;
    },
    [section, spotanimSequenceTicksById, lookupGamevalByName, combinedRev],
  );

  const buildTablePlan = React.useCallback(
    ({ displayRows, combinedRev: revArg }: { displayRows: ConfigArchiveTableRow[]; combinedRev: number }) => {
      const keys = openruneEntityArchiveColumnKeys(section, displayRows.length > 0 ? displayRows : [], revArg);
      const gvType = meta.gamevalType;
      const colCount = keys.length + (showImageCol ? 1 : 0);

      return {
        colgroup: (
          <>
            <col className="w-16" />
            {showImageCol ? (
              <col className={section === "items" ? "w-12" : "w-14"} />
            ) : null}
            {keys.map((colKey) => (
              <col key={colKey} className={colKey === "gameval" ? "min-w-[10rem]" : colKey === "tickDuration" ? "w-36" : colKey === "animationId" ? "min-w-[8rem]" : "min-w-[6rem]"} />
            ))}
          </>
        ),
        headerCellsAfterId: (
          <>
            {showImageCol ? (
              <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Image</TableHead>
            ) : null}
            {keys.map((key) => (
              <TableHead key={key} className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>
                {openruneColumnHeaderLabel(key)}
              </TableHead>
            ))}
          </>
        ),
        renderTableRow: (row: ConfigArchiveTableRow) => {
          const entries = rowEntriesForCell(row);
          return (
            <TableRow key={row.id} className="border-t align-top hover:bg-muted/35">
              <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono")}>{row.id}</TableCell>
              {showImageCol ? (
                <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, section === "items" ? "p-1" : "p-2")}>
                  <div
                    className={cn(
                      "inline-flex shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30",
                      section === "items" ? "h-8 w-8 p-0.5" : "h-12 w-12 p-1",
                    )}
                  >
                    {section === "items" ? <OpenRuneItemImage id={row.id} /> : <OpenRuneNpcImage id={row.id} />}
                  </div>
                </TableCell>
              ) : null}
              {keys.map((key) => {
                if (key === "animationId" && section === "spotanim") {
                  const animIdRaw = row.entries.animationId;
                  const nameOnly =
                    animIdRaw != null && animIdRaw.includes(".")
                      ? animIdRaw.slice(animIdRaw.lastIndexOf(".") + 1)
                      : (animIdRaw ?? "");
                  const resolvedId =
                    nameOnly !== ""
                      ? lookupGamevalByName(SEQTYPES, nameOnly, revArg)
                      : undefined;
                  const display = nameOnly !== "" ? nameOnly : (animIdRaw ?? "");
                  return (
                    <TableCell key={key} className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                      {display === "" ? (
                        "—"
                      ) : resolvedId != null ? (
                        <button
                          type="button"
                          className={TABLE_GAMEVAL_BUTTON_CLASS}
                          onClick={() =>
                            setOpenRef({
                              ref: { type: SEQTYPES, group: "sequences", name: nameOnly, raw: animIdRaw ?? display },
                              id: resolvedId,
                            })
                          }
                          title={`Open sequences.${display} (${resolvedId})`}
                        >
                          <span className="block max-w-[12rem] truncate">{display} ({resolvedId})</span>
                        </button>
                      ) : (
                        <span className="block max-w-[12rem] truncate">{display}</span>
                      )}
                    </TableCell>
                  );
                }
                return (
                  <OpenRuneArchiveTableCell
                    key={key}
                    section={section}
                    columnKey={key}
                    row={row}
                    entries={entries}
                    combinedRev={revArg}
                    tableBase={TABLE_BASE}
                    gamevalType={gvType}
                    lookupGameval={lookupGameval}
                    getGamevalExtra={getGamevalExtra}
                  />
                );
              })}
            </TableRow>
          );
        },
        renderSkeletonRows: (perPage: number) =>
          Array.from({ length: perPage }, (_, i) => (
            <TableRow key={`${section}-sk-${i}`} className="border-t align-top hover:bg-transparent">
              <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                <Skeleton className="h-4 w-10" delayMs={Math.min(i, 24) * 18} shimmer={false} />
              </TableCell>
              {showImageCol ? (
                <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                  <Skeleton
                    className={section === "items" ? "h-8 w-8 rounded border" : "h-12 w-12 rounded border"}
                    delayMs={Math.min(i, 24) * 18 + 8}
                  />
                </TableCell>
              ) : null}
              {keys.map((_, j) => (
                <TableCell key={j} className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                  <Skeleton className="h-4 w-20" delayMs={Math.min(i, 24) * 18 + 10 + j * 6} shimmer={false} />
                </TableCell>
              ))}
            </TableRow>
          )),
        emptyColSpan: Math.max(1, 1 + colCount),
        loadingAriaLabel: `Loading ${meta.tableEntityPlural} table`,
        readyAriaLabel: `${meta.title} table`,
      };
    },
    [lookupGameval, lookupGamevalByName, getGamevalExtra, meta.gamevalType, meta.tableEntityPlural, meta.title, rowEntriesForCell, section, setOpenRef, showImageCol],
  );

  const tableSearchDisabledModes = React.useMemo((): readonly DiffSearchFieldMode[] => {
    if (!useGamevalColumn) {
      return ["gameval"];
    }
    const nameRegex: DiffSearchFieldMode[] = ["name", "regex"];
    if (section === "items" || section === "npcs") {
      if (combinedRev < GAMEVAL_MIN_REVISION) return ["gameval"];
      return [];
    }
    if (combinedRev < GAMEVAL_MIN_REVISION) return ["gameval", ...nameRegex];
    return nameRegex;
  }, [combinedRev, useGamevalColumn, section]);

  const tableSearchModeTitles = React.useMemo(() => {
    const revHint = `Needs revision ${GAMEVAL_MIN_REVISION}+ (current ${combinedRev}).`;
    const nameRegexHelp = {
      name: "Substring match across visible row fields.",
      regex: "JavaScript-style regex over concatenated row fields.",
    } as const;
    if (!useGamevalColumn) {
      return {
        gameval: meta.searchHint,
        ...nameRegexHelp,
      } as const;
    }
    if (section === "items" || section === "npcs") {
      if (combinedRev < GAMEVAL_MIN_REVISION) {
        return {
          gameval: revHint,
          ...nameRegexHelp,
        } as const;
      }
      return {
        gameval: meta.searchHint,
        ...nameRegexHelp,
      } as const;
    }
    if (combinedRev < GAMEVAL_MIN_REVISION) {
      return {
        gameval: revHint,
        name: meta.searchHint,
        regex: meta.searchHint,
      } as const;
    }
    return { name: meta.searchHint, regex: meta.searchHint } as const;
  }, [combinedRev, meta.searchHint, useGamevalColumn, section]);

  const gamevalAutocomplete =
    meta.gamevalType != null
      ? {
          type: meta.gamevalType,
          revUsesCombined: true as const,
          enabled: meta.suggestionEnabled,
        }
      : null;

  const gamevalBulkFilter =
    meta.gamevalType != null
      ? {
          filterGamevalType: meta.gamevalType,
          rowToFilterId: (row: ConfigArchiveTableRow) => row.id,
          bulkPageSize: GAMEVAL_BULK_PAGE,
          preloadTypes: [meta.gamevalType],
          readyWhenLoaded: meta.gamevalType,
        }
      : null;

  return (
    <>
      <DiffConfigArchiveView
      diffViewMode={diffViewMode}
      combinedRev={combinedRev}
      baseRev={baseRev}
      rev={rev}
      configType={section}
      tableBase={TABLE_BASE}
      title={meta.title}
      labels={{
        tableEntitySingular: meta.tableEntitySingular,
        tableEntityPlural: meta.tableEntityPlural,
        textLineSingular: "line",
        textLinePlural: "lines",
        paginationCountLabel: meta.paginationCountLabel,
        emptyTableMessage: meta.emptyTableMessage,
        decodingMessage: meta.decodingMessage,
        tableErrorVerb: meta.tableErrorVerb,
        contentErrorVerb: meta.contentErrorVerb,
        gamevalFilterErrorVerb: meta.gamevalFilterErrorVerb,
      }}
      tableSearch={{ disabledModes: tableSearchDisabledModes, modeTitles: tableSearchModeTitles }}
      gamevalAutocomplete={gamevalAutocomplete}
      gamevalBulkFilter={gamevalBulkFilter}
      buildTablePlan={buildTablePlan}
        TextLine={ArchivePlainTextLine}
        textRowHeight={TEXT_LINE_HEIGHT}
      />
      <GamevalReferenceDialog
        combinedRev={combinedRev}
        openRef={openRef}
        onOpenChange={(open) => {
          if (!open) setOpenRef(null);
        }}
        lookupGameval={lookupGameval}
        getGamevalExtra={getGamevalExtra}
      />
    </>
  );
}
