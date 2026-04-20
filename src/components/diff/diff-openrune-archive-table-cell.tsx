"use client";

import * as React from "react";

import { LazyWhenVisible } from "@/components/ui/lazy-when-visible";
import { RsColorBox } from "@/components/ui/rs-color-box";
import { RSSprite } from "@/components/ui/RSSprite";
import { RSTexture } from "@/components/ui/RSTexture";
import { TableCell } from "@/components/ui/table";
import { GAMEVAL_TYPE_MAP, IFTYPES, type GamevalType } from "@/context/gameval-context";
import { useSettings } from "@/context/settings-context";
import { onCopyApplyGamevalUppercaseSetting } from "@/lib/gameval-clipboard";
import { cn } from "@/lib/utils";

import { parsePackedHslValue } from "./diff-archive-table-utils";
import type { ConfigArchiveTableRow, ConfigFieldRenderSchema } from "./diff-config-archive-types";
import { GAMEVAL_MIN_REVISION } from "./diff-constants";
import { DIFF_ARCHIVE_TABLE_CELL_CLASS } from "./diff-table-archive-styles";
import { getParamSmartDefault, getParamSmartDefaultField, type ArchiveEntitySection } from "./diff-openrune-archive-columns";

/** Detect if a value is a gameval reference object. */
function isGamevalRef(value: unknown): value is { value: unknown; ref: { group: string; id: number; name: string } } {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (!obj.ref || typeof obj.ref !== "object") return false;
  const ref = obj.ref as Record<string, unknown>;
  return typeof ref.group === "string" && typeof ref.id === "number" && typeof ref.name === "string";
}



const ITEM_IMAGE_BASE = "https://chisel.weirdgloop.org/static/img/osrs-sprite/";
const NPC_IMAGE_BASE = "https://chisel.weirdgloop.org/static/img/osrs-npc/";
const OBJECT_IMAGE_BASE = "https://chisel.weirdgloop.org/static/img/osrs-object/";
const TABLE_PIP_BUTTON_CLASS =
  "cursor-pointer rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-xs font-mono text-sky-800 transition-colors hover:bg-sky-500/20 hover:border-sky-500/60 dark:text-sky-200 dark:hover:bg-sky-500/20";

const GAMEVAL_TYPE_BY_ENUM_NAME: Record<string, GamevalType> = Object.fromEntries(
  Object.entries(GAMEVAL_TYPE_MAP).map(([enumName, type]) => [enumName.toLowerCase(), type]),
) as Record<string, GamevalType>;

const GAMEVAL_GROUP_ALIASES: Record<string, GamevalType> = {
  components: IFTYPES,
  interface: IFTYPES,
};

function normalizeRefGroupToType(group: string): GamevalType {
  const normalized = group.trim().toLowerCase();
  const alias = GAMEVAL_GROUP_ALIASES[normalized];
  if (alias) return alias;
  const mapped = GAMEVAL_TYPE_BY_ENUM_NAME[normalized];
  if (mapped) return mapped;
  return normalized;
}

function resolveSchema(
  fieldRenderSchemaByField: Record<string, ConfigFieldRenderSchema> | undefined,
  field: string,
): ConfigFieldRenderSchema | undefined {
  if (!fieldRenderSchemaByField) return undefined;
  if (fieldRenderSchemaByField[field]) return fieldRenderSchemaByField[field];
  const lower = field.toLowerCase();
  return Object.entries(fieldRenderSchemaByField).find(([k]) => k.toLowerCase() === lower)?.[1];
}

function resolveNumericValue(raw: string | undefined, rawEntry: unknown): number {
  if (isGamevalRef(rawEntry)) {
    return Number(rawEntry.value);
  }
  return raw != null && raw !== "" ? Number(raw) : Number.NaN;
}

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

export const OpenRuneObjectImage = React.memo(function OpenRuneObjectImage({ id }: { id: number }) {
  return (
    <ChiselStaticThumb src={`${OBJECT_IMAGE_BASE}${id}_orient3.png`} pixelSize={48} boxClassName="h-12 w-12" />
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
  onOpenRef?: (ref: { ref: { type: GamevalType; group: string; name: string; raw: string }; id: number }) => void;
  pipTooltip?: boolean;
  fieldRenderSchemaByField?: Record<string, ConfigFieldRenderSchema>;
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
  onOpenRef,
  pipTooltip = true,
  fieldRenderSchemaByField,
}: OpenRuneArchiveTableCellProps) {
  const { settings } = useSettings();
  const raw = entries[columnKey];
  const rawEntry = row.entriesRaw?.[columnKey];
  const schema = resolveSchema(fieldRenderSchemaByField, columnKey);
  const schemaKind = schema?.kind;

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

  if (columnKey === "default" && section === "param") {
    const smartDefault = getParamSmartDefault(entries);
    const selectedDefaultField = getParamSmartDefaultField(entries);
    const rawEntry = row.entriesRaw?.[selectedDefaultField];
    if (isGamevalRef(rawEntry)) {
      const gvRef = rawEntry.ref;
      const display = gvRef.name.trim() || String(smartDefault);
      const type = normalizeRefGroupToType(gvRef.group);
      const openTitle = `${gvRef.group}.${gvRef.name} (${gvRef.id})`;
      return (
        <TableCellWrap
          className="text-muted-foreground"
          data-col-key="default"
          onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)}
        >
          {onOpenRef ? (
            <button
              type="button"
              className={TABLE_PIP_BUTTON_CLASS}
              onClick={() => onOpenRef({ ref: { type, group: gvRef.group, name: gvRef.name, raw: `${gvRef.group}.${gvRef.name}` }, id: gvRef.id })}
              title={pipTooltip ? `Open ${openTitle}` : undefined}
            >
              {display} ({gvRef.id})
            </button>
          ) : (
            `${display} (${gvRef.id})`
          )}
        </TableCellWrap>
      );
    }
    return <TableCellWrap>{smartDefault}</TableCellWrap>;
  }

  if (schemaKind === "texture" && combinedRev >= 1) {
    const textureId = resolveNumericValue(raw, rawEntry);
    if (!Number.isNaN(textureId) && textureId >= 0) {
      const underlayRaw = section === "overlay" ? (entries.underlay ?? entries.underlayTextureId) : undefined;
      const underlayId = underlayRaw != null && underlayRaw !== "" ? Number(underlayRaw) : Number.NaN;
      const showUnderlay = section === "overlay" && !Number.isNaN(underlayId) && underlayId >= 0;
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

  if (schemaKind === "sprite") {
    const spriteId = resolveNumericValue(raw, rawEntry);
    if (!Number.isNaN(spriteId) && spriteId >= 0) {
      return (
        <TableCellWrap>
          <RSSprite id={spriteId} rev={combinedRev} width={32} height={32} fitMax keepAspectRatio rounded className="shrink-0 rounded-[2px]" enableClickModel />
        </TableCellWrap>
      );
    }
  }

  if (schemaKind === "colour") {
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

    // Auto-detect gameval references in any column
    if (isGamevalRef(rawEntry)) {
      const gvRef = rawEntry.ref;
      const display = gvRef.name.trim() || String(rawEntry.value);
      const type = normalizeRefGroupToType(gvRef.group);
      const openTitle = `${gvRef.group}.${gvRef.name} (${gvRef.id})`;
      return (
        <TableCellWrap
          className="text-muted-foreground"
          data-col-key={columnKey}
          onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)}
        >
          {onOpenRef ? (
            <button
              type="button"
              className={TABLE_PIP_BUTTON_CLASS}
              onClick={() => onOpenRef({ ref: { type, group: gvRef.group, name: gvRef.name, raw: `${gvRef.group}.${gvRef.name}` }, id: gvRef.id })}
              title={pipTooltip ? `Open ${openTitle}` : undefined}
            >
              {display} ({gvRef.id})
            </button>
          ) : (
            `${display} (${gvRef.id})`
          )}
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
