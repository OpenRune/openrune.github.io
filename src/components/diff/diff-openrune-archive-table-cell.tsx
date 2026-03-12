"use client";

import * as React from "react";

import { LazyWhenVisible } from "@/components/ui/lazy-when-visible";
import { RsColorBox } from "@/components/ui/rs-color-box";
import { RSTexture } from "@/components/ui/RSTexture";
import { TableCell } from "@/components/ui/table";
import type { GamevalType } from "@/context/gameval-context";
import { useSettings } from "@/context/settings-context";
import { onCopyApplyGamevalUppercaseSetting } from "@/lib/gameval-clipboard";
import { cn } from "@/lib/utils";

import { parsePackedHslValue } from "./diff-archive-table-utils";
import type { ConfigArchiveTableRow } from "./diff-config-archive-types";
import { GAMEVAL_MIN_REVISION } from "./diff-constants";
import { DIFF_ARCHIVE_TABLE_CELL_CLASS } from "./diff-table-archive-styles";
import type { ArchiveEntitySection } from "./diff-openrune-archive-columns";

const COLOR_COLUMN_KEYS = new Set(["colour", "mapcolour", "rgb", "averageRgb"]);
const TEXTURE_ID_COLUMN_KEY = "texture";

const ITEM_IMAGE_BASE = "https://chisel.weirdgloop.org/static/img/osrs-sprite/";
const NPC_IMAGE_BASE = "https://chisel.weirdgloop.org/static/img/osrs-npc/";

function ChiselStaticThumb({
  src,
  pixelSize,
  boxClassName,
}: {
  src: string;
  pixelSize: number;
  boxClassName: string;
}) {
  const [error, setError] = React.useState(false);
  if (error) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded border bg-muted/60 text-[10px] text-muted-foreground",
          boxClassName,
        )}
        aria-hidden
      >
        —
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={pixelSize}
      height={pixelSize}
      className="h-full w-full object-contain"
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      onError={() => setError(true)}
    />
  );
}

export const OpenRuneItemImage = React.memo(function OpenRuneItemImage({ id }: { id: number }) {
  return (
    <ChiselStaticThumb src={`${ITEM_IMAGE_BASE}${id}.png`} pixelSize={32} boxClassName="h-8 w-8" />
  );
});

export const OpenRuneNpcImage = React.memo(function OpenRuneNpcImage({ id }: { id: number }) {
  return (
    <ChiselStaticThumb src={`${NPC_IMAGE_BASE}${id}_128.png`} pixelSize={48} boxClassName="h-12 w-12" />
  );
});

export function formatTickDurationDisplay(value: string | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "?";
  if (n === -1) return "?";
  const seconds = n * 0.6;
  return `${n} ticks (${seconds.toFixed(1)}s)`;
}

function formatNotedDisplay(value: string | undefined): string {
  if (value === "true") return "true";
  if (value === "false") return "false";
  return value ?? "—";
}

type OpenRuneArchiveTableCellProps = {
  section: ArchiveEntitySection;
  columnKey: string;
  row: ConfigArchiveTableRow;
  /** Row entries (possibly with derived `tickDuration` for seq/spotanim). */
  entries: Record<string, string>;
  combinedRev: number;
  /** Cache table base (overlays / textures). Defaults to `1`. */
  tableBase?: number;
  gamevalType: GamevalType | null;
  lookupGameval: (type: GamevalType, id: number, rev?: number | "latest") => string | undefined;
  getGamevalExtra: (
    type: GamevalType,
    id: number,
    rev?: number | "latest",
  ) => { searchable: string; text: string; sub: Record<number, string> } | undefined;
};

export const OpenRuneArchiveTableCell = React.memo(function OpenRuneArchiveTableCell({
  section,
  columnKey,
  row,
  entries,
  combinedRev,
  tableBase = 1,
  gamevalType,
  lookupGameval,
  getGamevalExtra,
}: OpenRuneArchiveTableCellProps) {
  const { settings } = useSettings();
  const raw = entries[columnKey];

  if (columnKey === "gameval" && gamevalType != null && combinedRev >= GAMEVAL_MIN_REVISION) {
    const derived =
      lookupGameval(gamevalType, row.id, combinedRev)?.trim() ||
      getGamevalExtra(gamevalType, row.id, combinedRev)?.searchable?.trim() ||
      raw?.trim() ||
      "";
    return (
      <TableCellWrap
        className="text-muted-foreground"
        data-col-key="gameval"
        onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)}
      >
        {derived || "—"}
      </TableCellWrap>
    );
  }

  if (columnKey === "tickDuration") {
    return <TableCellWrap>{formatTickDurationDisplay(raw)}</TableCellWrap>;
  }

  if (columnKey === "noted") {
    return <TableCellWrap>{formatNotedDisplay(raw)}</TableCellWrap>;
  }

  if (columnKey === "name") {
    if (raw == null || raw === "") {
      return <TableCellWrap>—</TableCellWrap>;
    }
    return <TableCellWrap>{raw}</TableCellWrap>;
  }

  if (columnKey === TEXTURE_ID_COLUMN_KEY && section === "overlay" && combinedRev >= 1) {
    const textureId = raw != null && raw !== "" ? Number(raw) : NaN;
    if (!Number.isNaN(textureId) && textureId >= 0) {
      const underlayRaw = entries.underlay ?? entries.underlayTextureId;
      const underlayId =
        underlayRaw != null && underlayRaw !== "" ? Number(underlayRaw) : Number.NaN;
      const showUnderlay = !Number.isNaN(underlayId) && underlayId >= 0;
      return (
        <TableCellWrap>
          <div className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-none border bg-muted/30 p-1">
            {showUnderlay ? (
              <span className="pointer-events-none absolute inset-1 z-0 flex items-center justify-center opacity-90">
                <LazyWhenVisible
                  as="span"
                  className="flex size-full items-center justify-center"
                  fallback={<span className="size-full rounded-none bg-muted/25" aria-hidden />}
                >
                  <RSTexture
                    textureDefinitionId={underlayId}
                    combinedDiffSprite
                    rev={combinedRev}
                    base={tableBase}
                    width={32}
                    height={32}
                    fitMax
                    keepAspectRatio
                  />
                </LazyWhenVisible>
              </span>
            ) : null}
            <span className={cn("relative z-[1] flex items-center justify-center", showUnderlay && "drop-shadow-sm")}>
              <LazyWhenVisible
                as="span"
                className="flex size-full items-center justify-center"
                fallback={<span className="size-full rounded-none bg-muted/25" aria-hidden />}
              >
                  <RSTexture
                    textureDefinitionId={textureId}
                    combinedDiffSprite
                    rev={combinedRev}
                    base={tableBase}
                    width={32}
                    height={32}
                    fitMax
                    keepAspectRatio
                    enableClickModel
                  />
              </LazyWhenVisible>
            </span>
          </div>
        </TableCellWrap>
      );
    }
  }

  if (COLOR_COLUMN_KEYS.has(columnKey)) {
    const packed = parsePackedHslValue(raw);
    return (
      <TableCellWrap>
        <div className="flex items-center gap-2">
          {packed != null ? (
            <RsColorBox width={32} height={32} packedHsl={packed} className="shrink-0 rounded-none" />
          ) : null}
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{raw ?? "—"}</span>
        </div>
      </TableCellWrap>
    );
  }

  const mono = typeof raw === "string" && /^[0-9x#a-fA-F-]+$/i.test(String(raw));
  return (
    <TableCellWrap>
      <span className={cn(mono && "font-mono")}>{raw ?? "—"}</span>
    </TableCellWrap>
  );
});

function TableCellWrap({
  className,
  children,
  ...rest
}: React.ComponentProps<typeof TableCell>) {
  return (
    <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "text-xs", className)} {...rest}>
      {children}
    </TableCell>
  );
}
