"use client";

import * as React from "react";

import { LazyWhenVisible } from "@/components/ui/lazy-when-visible";
import { RsColorBox } from "@/components/ui/rs-color-box";
import { RSTexture } from "@/components/ui/RSTexture";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { SPRITETYPES, useGamevals } from "@/context/gameval-context";
import { useSettings } from "@/context/settings-context";
import { onCopyApplyGamevalUppercaseSetting } from "@/lib/gameval-clipboard";
import { cn } from "@/lib/utils";
import { DiffConfigArchiveView } from "./diff-config-archive-view";
import { ZipArchiveDownloadButton } from "./zip-archive-download-button";
import { parsePackedHslValue } from "./diff-archive-table-utils";
import { openruneColumnHeaderLabel, openruneTextureArchiveColumnKeys } from "./diff-openrune-archive-columns";
import type {
  ConfigArchiveTableRow,
  DiffConfigArchiveTablePlan,
  DiffConfigArchiveTextLineProps,
} from "./diff-config-archive-types";
import { GAMEVAL_MIN_REVISION } from "./diff-constants";
import type { DiffMode, DiffSearchFieldMode } from "./diff-types";
import {
  DIFF_ARCHIVE_TABLE_CELL_CLASS,
  DIFF_ARCHIVE_TABLE_HEAD_CLASS,
  DIFF_ARCHIVE_TABLE_ROW_INTERACTIVE_CLASS,
} from "./diff-table-archive-styles";

const TEXTURE_CONFIG_TYPE = "textures";
const TABLE_BASE = 1;
const TEXTURE_GAMEVAL_BULK_PAGE = 500;
const TEXTURE_TEXT_LINE_HEIGHT = 28;

type DiffTexturesViewProps = {
  diffViewMode: DiffMode;
  combinedRev: number;
  baseRev: number;
  rev: number;
};

function formatBoolishCell(entries: Record<string, string>, key: string): string {
  if (key === "transparent" || key === "isTransparent") {
    const v = entries.transparent ?? entries.isTransparent;
    if (v == null || v === "") return "—";
    return formatBoolish(String(v));
  }
  const v = entries[key];
  if (v == null || v === "") return "—";
  if (key === "lowDetail" || key === "lowMem") return formatBoolish(String(v));
  return String(v);
}

function formatBoolish(value: string): string {
  const s = String(value).toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return "true";
  if (s === "false" || s === "0" || s === "no") return "false";
  return String(value);
}

function getFileId(entries: Record<string, string>): number | null {
  const raw = entries.fileId;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

type TextureLineInlinePart =
  | { kind: "text"; text: string }
  | { kind: "rgbField"; literal: string; rawValue: string }
  | { kind: "fileField"; literal: string; fileId: number };

function parseTextureLineInlineParts(line: string): TextureLineInlinePart[] {
  const re = /(averageRgb|fileId)=(-?\d+)/g;
  const parts: TextureLineInlinePart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      parts.push({ kind: "text", text: line.slice(last, m.index) });
    }
    const key = m[1];
    const raw = m[2];
    const literal = m[0];
    if (key === "averageRgb") {
      parts.push({ kind: "rgbField", literal, rawValue: raw });
    } else {
      const fileId = Number(raw);
      parts.push({ kind: "fileField", literal, fileId });
    }
    last = m.index + literal.length;
  }
  if (last < line.length) {
    parts.push({ kind: "text", text: line.slice(last) });
  }
  if (parts.length === 0) {
    parts.push({ kind: "text", text: line });
  }
  return parts;
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

const TEXTURE_FIND_MARK_CLASS =
  "rounded-[2px] bg-yellow-300/90 px-0.5 font-mono text-sm font-normal not-italic text-foreground dark:bg-yellow-500/45";

const TextureFindHighlightedText = React.memo(function TextureFindHighlightedText({
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
  const segs =
    kind === "literal" ? splitHighlightLiteral(text, query) : splitHighlightRegex(text, query);
  const list = segs ?? [{ text, highlight: false }];
  return (
    <>
      {list.map((seg, i) =>
        seg.highlight ? (
          <mark key={i} className={TEXTURE_FIND_MARK_CLASS}>
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
});

const DiffTextureTextLine = React.memo(function DiffTextureTextLine({
  line,
  combinedRev,
  showInline = false,
  findKind,
  findQuery,
  findMarkActive,
}: DiffConfigArchiveTextLineProps) {
  const hl =
    findMarkActive && findQuery?.trim()
      ? { kind: findKind ?? "literal", query: findQuery.trim(), active: true as const }
      : null;

  if (!showInline) {
    return (
      <span className="whitespace-pre">
        <TextureFindHighlightedText
          text={line || " "}
          kind={hl?.kind ?? "literal"}
          query={hl?.query ?? ""}
          enabled={Boolean(hl)}
        />
      </span>
    );
  }
  const parts = parseTextureLineInlineParts(line || "");
  return (
    <span className="min-w-0 whitespace-pre align-middle">
      {parts.map((p, i) => {
        if (p.kind === "text") {
          return (
            <span key={i}>
              <TextureFindHighlightedText
                text={p.text}
                kind={hl?.kind ?? "literal"}
                query={hl?.query ?? ""}
                enabled={Boolean(hl)}
              />
            </span>
          );
        }
        if (p.kind === "rgbField") {
          const packed = parsePackedHslValue(p.rawValue);
          return (
            <span key={i} className="inline-flex max-w-full items-center gap-0.5 align-middle">
              <span>
                <TextureFindHighlightedText
                  text={p.literal}
                  kind={hl?.kind ?? "literal"}
                  query={hl?.query ?? ""}
                  enabled={Boolean(hl)}
                />
              </span>
              {packed != null ? (
                <RsColorBox
                  width={16}
                  height={16}
                  packedHsl={packed}
                  className="shrink-0 rounded-none align-middle"
                />
              ) : null}
            </span>
          );
        }
        return (
          <span key={i} className="inline-flex max-w-full items-center gap-0.5 align-middle">
            <span>
              <TextureFindHighlightedText
                text={p.literal}
                kind={hl?.kind ?? "literal"}
                query={hl?.query ?? ""}
                enabled={Boolean(hl)}
              />
            </span>
            {Number.isFinite(p.fileId) ? (
              <span className="relative inline-flex h-4 w-4 shrink-0 align-middle rounded-none border border-border bg-muted/30 leading-none">
                <LazyWhenVisible
                  as="span"
                  rootMargin="120px"
                  className="absolute inset-0 size-full"
                  fallback={<span className="absolute inset-0 rounded-none bg-muted/25" aria-hidden />}
                >
                  <RSTexture
                    id={p.fileId}
                    width={16}
                    height={16}
                    base={TABLE_BASE}
                    rev={combinedRev}
                    combinedDiffSprite
                    keepAspectRatio
                    fitMax
                    fillCell
                    className="absolute inset-0 h-full w-full"
                    enableClickModel
                  />
                </LazyWhenVisible>
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
});

export function DiffTexturesView({ diffViewMode, combinedRev, baseRev, rev }: DiffTexturesViewProps) {
  const { getGamevalExtra } = useGamevals();
  const { settings } = useSettings();
  const textureGamevalSupported = combinedRev >= GAMEVAL_MIN_REVISION;

  const [textureModal, setTextureModal] = React.useState<{
    fileId: number;
    textureDefinitionId?: number;
  } | null>(null);

  React.useEffect(() => {
    setTextureModal(null);
  }, [combinedRev]);

  const buildTablePlan = React.useCallback(
    ({ displayRows }: { displayRows: ConfigArchiveTableRow[]; combinedRev: number }): DiffConfigArchiveTablePlan => {
      const dataKeys = openruneTextureArchiveColumnKeys(displayRows.length > 0 ? displayRows : []);
      return {
      colgroup: (
        <>
          <col className="w-16" />
          <col className="w-14" />
          {textureGamevalSupported ? <col /> : null}
          {dataKeys.map((colKey) => (
            <col key={colKey} className={colKey === "averageRgb" ? "w-28" : "min-w-[6rem]"} />
          ))}
        </>
      ),
      headerCellsAfterId: (
        <>
          <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Image</TableHead>
          {textureGamevalSupported ? (
            <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Gameval</TableHead>
          ) : null}
          {dataKeys.map((key) => (
            <TableHead key={key} className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>
              {openruneColumnHeaderLabel(key)}
            </TableHead>
          ))}
        </>
      ),
      renderTableRow: (row: ConfigArchiveTableRow) => {
        const fileId = getFileId(row.entries);
        const spriteGamevalSearchable =
          fileId != null && textureGamevalSupported
            ? getGamevalExtra(SPRITETYPES, fileId, combinedRev)?.searchable?.trim() || null
            : null;
        return (
          <TableRow
            key={row.id}
            className={cn(
              fileId != null ? DIFF_ARCHIVE_TABLE_ROW_INTERACTIVE_CLASS : "border-t align-top hover:bg-muted/35",
            )}
            role={fileId != null ? "button" : undefined}
            tabIndex={fileId != null ? 0 : undefined}
            onClick={() => {
              if (fileId != null) setTextureModal({ fileId, textureDefinitionId: row.id });
            }}
            onKeyDown={(e) => {
              if (fileId != null && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                setTextureModal({ fileId, textureDefinitionId: row.id });
              }
            }}
          >
            <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono")}>{row.id}</TableCell>
            <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
              <div className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-none border border-border bg-muted/30 p-0">
                {fileId != null ? (
                  <LazyWhenVisible
                    className="absolute inset-0 min-h-10 min-w-10"
                    fallback={<div className="absolute inset-0 rounded-none bg-muted/30" aria-hidden />}
                  >
                    <RSTexture
                      id={fileId}
                      textureDefinitionId={row.id}
                      gameval={spriteGamevalSearchable ?? undefined}
                      gamevalRevision={combinedRev}
                      width={32}
                      height={32}
                      base={TABLE_BASE}
                      rev={combinedRev}
                      combinedDiffSprite
                      fitMax
                      fillCell
                      className="absolute inset-0 h-full w-full"
                      keepAspectRatio
                    />
                  </LazyWhenVisible>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </TableCell>
            {textureGamevalSupported ? (
              <TableCell
                className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "text-muted-foreground")}
                data-col-key="gameval"
                onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)}
              >
                {spriteGamevalSearchable ?? "—"}
              </TableCell>
            ) : null}
            {dataKeys.map((key) => {
              if (key === "averageRgb") {
                const packed = parsePackedHslValue(row.entries.averageRgb);
                return (
                  <TableCell key={key} className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                    <div className="flex items-center gap-2">
                      {packed != null ? (
                        <RsColorBox width={32} height={32} packedHsl={packed} className="shrink-0 rounded-none" />
                      ) : null}
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {row.entries.averageRgb ?? "—"}
                      </span>
                    </div>
                  </TableCell>
                );
              }
              return (
                <TableCell key={key} className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "text-xs")}>
                  {formatBoolishCell(row.entries, key)}
                </TableCell>
              );
            })}
          </TableRow>
        );
      },
      renderSkeletonRows: (perPage: number) =>
        Array.from({ length: perPage }, (_, i) => (
          <TableRow key={`tex-sk-${i}`} className="border-t align-top hover:bg-transparent">
            <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
              <Skeleton className="h-4 w-10" delayMs={Math.min(i, 24) * 18} shimmer={false} />
            </TableCell>
            <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
              <Skeleton className="h-10 w-10 rounded-none" delayMs={Math.min(i, 24) * 18 + 10} />
            </TableCell>
            {textureGamevalSupported ? (
              <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                <Skeleton className="h-4 w-32 max-w-full" delayMs={Math.min(i, 24) * 18 + 14} shimmer={false} />
              </TableCell>
            ) : null}
            {dataKeys.map((_, j) => (
              <TableCell key={j} className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                <Skeleton className="h-4 w-14" delayMs={Math.min(i, 24) * 18 + 20 + j * 6} shimmer={false} />
              </TableCell>
            ))}
          </TableRow>
        )),
      emptyColSpan: 2 + dataKeys.length + (textureGamevalSupported ? 1 : 0),
      loadingAriaLabel: "Loading textures table",
      readyAriaLabel: "Textures table",
    };
    },
    [combinedRev, textureGamevalSupported, getGamevalExtra, setTextureModal, settings.copyGamevalsToUppercase],
  );

  const tableSearchDisabledModes = React.useMemo((): readonly DiffSearchFieldMode[] => {
    const texturesOnly: DiffSearchFieldMode[] = ["name", "regex"];
    if (combinedRev < GAMEVAL_MIN_REVISION) return ["gameval", ...texturesOnly];
    return texturesOnly;
  }, [combinedRev]);

  const tableSearchModeTitles = React.useMemo(() => {
    const texturesOnly = "Textures: use ID or Gameval only.";
    const revHint = `Needs revision ${GAMEVAL_MIN_REVISION}+ (current ${combinedRev}).`;
    if (combinedRev < GAMEVAL_MIN_REVISION) {
      return {
        gameval: revHint,
        name: texturesOnly,
        regex: texturesOnly,
      } as const;
    }
    return { name: texturesOnly, regex: texturesOnly } as const;
  }, [combinedRev]);

  return (
    <>
      <DiffConfigArchiveView
        diffViewMode={diffViewMode}
        combinedRev={combinedRev}
        baseRev={baseRev}
        rev={rev}
        configType={TEXTURE_CONFIG_TYPE}
        tableBase={TABLE_BASE}
        title="Textures"
        labels={{
          tableEntitySingular: "texture",
          tableEntityPlural: "textures",
          textLineSingular: "line",
          textLinePlural: "lines",
          paginationCountLabel: "textures",
          emptyTableMessage: "No texture rows for this revision (or no matches).",
          decodingMessage: "Texture data is still decoding on the cache server. Try again in a moment.",
          tableErrorVerb: "load textures table",
          contentErrorVerb: "load textures content",
          gamevalFilterErrorVerb: "filter textures by gameval",
        }}
        tableSearch={{ disabledModes: tableSearchDisabledModes, modeTitles: tableSearchModeTitles }}

        gamevalAutocomplete={{
          type: SPRITETYPES,
          revUsesCombined: true,
          enabled: (d) => d.sprites,
          restrictToCombinedSpriteIds: true,
        }}
        gamevalBulkFilter={{
          filterGamevalType: SPRITETYPES,
          rowToFilterId: (row) => getFileId(row.entries),
          bulkPageSize: TEXTURE_GAMEVAL_BULK_PAGE,
          preloadTypes: [SPRITETYPES],
          readyWhenLoaded: SPRITETYPES,
        }}
        buildTablePlan={buildTablePlan}
        tableSearchSize="large"
        TextLine={DiffTextureTextLine}
        textRowHeight={(s) => (s.suggestionDisplay.textures ? 40 : TEXTURE_TEXT_LINE_HEIGHT)}
        getTextLineShowInline={(s) => s.suggestionDisplay.textures}
        searchRowTrailing={
          <ZipArchiveDownloadButton
            kind="textures"
            diffViewMode={diffViewMode}
            combinedRev={combinedRev}
            baseRev={baseRev}
            rev={rev}
            tableBase={TABLE_BASE}
          />
        }
      />

      {textureModal != null ? (
        <div className="sr-only fixed top-0 left-0 h-0 w-0 overflow-hidden" aria-hidden>
          <RSTexture
            key={textureModal.fileId}
            id={textureModal.fileId}
            textureDefinitionId={textureModal.textureDefinitionId}
            gameval={
              combinedRev >= GAMEVAL_MIN_REVISION
                ? getGamevalExtra(SPRITETYPES, textureModal.fileId, combinedRev)?.searchable?.trim() || undefined
                : undefined
            }
            gamevalRevision={combinedRev}
            width={1}
            height={1}
            base={TABLE_BASE}
            rev={combinedRev}
            combinedDiffSprite
            enableClickModel
            modalOpen
            onModalOpenChange={(open) => {
              if (!open) setTextureModal(null);
            }}
          />
        </div>
      ) : null}
    </>
  );
}
