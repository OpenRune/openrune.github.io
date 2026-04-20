"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow, Table } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCacheType } from "@/context/cache-type-context";
import type { GamevalExtraData, GamevalType } from "@/context/gameval-context";
import {
  GAMEVAL_TYPE_MAP,
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
import { cacheProxyHeaders, diffConfigSchemaUrl, diffSpriteResolveUrl } from "@/lib/cache-proxy-client";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";
import { cn } from "@/lib/utils";
import { RsColorBox } from "@/components/ui/rs-color-box";
import { RSSprite } from "@/components/ui/RSSprite";
import { RSTexture } from "@/components/ui/RSTexture";

import { DiffConfigArchiveView } from "./diff-config-archive-view";
import type {
  ConfigArchiveTableRow,
  ConfigFieldRenderSchema,
  DiffConfigArchiveTextLineProps,
} from "./diff-config-archive-types";
import { GAMEVAL_MIN_REVISION, interfaceComponentCombinedId, normalizeConfigTypeForCacheApi, sectionGamevalTypeForSection } from "./diff-constants";
import { configLinesFromCachePayload } from "./diff-config-content";
import type { ConfigLine, DiffMode, DiffSearchFieldMode } from "./diff-types";
import {
  getParamSmartDefaultField,
  openruneColumnHeaderLabel,
  openruneEntityArchiveColumnKeys,
  type TableColumnPreference,
} from "./diff-openrune-archive-columns";
import type { ArchiveEntitySection } from "./diff-openrune-archive-columns";
import {
  OpenRuneArchiveTableCell,
  OpenRuneItemImage,
  OpenRuneNpcImage,
  OpenRuneObjectImage,
} from "./diff-openrune-archive-table-cell";
import { DIFF_ARCHIVE_TABLE_CELL_CLASS, DIFF_ARCHIVE_TABLE_HEAD_CLASS } from "./diff-table-archive-styles";
import { useSpotanimSequenceTicks } from "./diff-spotanim-sequence-ticks";

export { ARCHIVE_ENTITY_SECTIONS, isArchiveEntitySection } from "./diff-openrune-archive-columns";
export type { ArchiveEntitySection } from "./diff-openrune-archive-columns";

const TABLE_BASE = 1;
const GAMEVAL_BULK_PAGE = 500;
const TEXT_LINE_HEIGHT = 28;


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

function parseFieldRenderSchemaPayload(data: unknown): {
  fields: Record<string, ConfigFieldRenderSchema>;
  tableColumns: TableColumnPreference[];
  searchFieldByMode: Partial<Record<"name" | "regex", string>>;
  hasGameval?: boolean;
} {
  if (!data || typeof data !== "object") return { fields: {}, tableColumns: [], searchFieldByMode: {} };
  const root = data as Record<string, unknown>;
  const fieldsRaw =
    root.fields && typeof root.fields === "object" ? (root.fields as Record<string, unknown>) : root;

  const fields: Record<string, ConfigFieldRenderSchema> = {};
  for (const [key, value] of Object.entries(fieldsRaw)) {
    if (typeof value === "string") fields[key] = { kind: value as ConfigFieldRenderSchema["kind"] };
  }

  const tableColumns: TableColumnPreference[] = [];
  const tableRaw = root.tableColumns;
  if (Array.isArray(tableRaw)) {
    for (const entry of tableRaw) {
      if (typeof entry === "string") {
        tableColumns.push(entry);
        continue;
      }
      if (Array.isArray(entry)) {
        const aliases = entry.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
        if (aliases.length > 0) tableColumns.push(aliases);
      }
    }
  }

  const searchFieldByMode: Partial<Record<"name" | "regex", string>> = {};
  const searchModesRaw = root.searchModes;
  if (searchModesRaw && typeof searchModesRaw === "object") {
    const raw = searchModesRaw as Record<string, unknown>;
    const nameField = raw.name;
    const regexField = raw.regex;
    if (typeof nameField === "string" && nameField.trim().length > 0) searchFieldByMode.name = nameField;
    if (typeof regexField === "string" && regexField.trim().length > 0) searchFieldByMode.regex = regexField;
  }

  const hasGameval = typeof root.hasGameval === "boolean" ? root.hasGameval : undefined;

  return { fields, tableColumns, searchFieldByMode, hasGameval };
}

function resolveFieldSchemaKind(
  fieldRenderSchemaByField: Record<string, ConfigFieldRenderSchema> | undefined,
  fieldName: string,
): ConfigFieldRenderSchema["kind"] | null {
  if (!fieldRenderSchemaByField) return null;
  const exact = fieldRenderSchemaByField[fieldName];
  if (exact?.kind) return exact.kind;
  const lower = fieldName.toLowerCase();
  for (const [key, value] of Object.entries(fieldRenderSchemaByField)) {
    if (key.toLowerCase() === lower && value.kind) return value.kind;
  }
  return null;
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

function RsSpriteSwatch({ value, combinedRev }: { value: number; combinedRev: number }) {
  return (
    <span className="mx-1.5 inline-block align-middle" style={{ lineHeight: 0 }}>
      <RSSprite
        id={value}
        rev={combinedRev}
        width={12}
        height={12}
        fitMax
        keepAspectRatio
        rounded
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

const INLINE_GAMEVAL_REF_REGEX = /\b([a-z][a-z0-9_]*)\.([A-Za-z0-9_:$\/-]+(?:\s*\++)?)/gi;
const INLINE_GAMEVAL_BUTTON_CLASS =
  "inline-flex h-[18px] cursor-pointer items-center whitespace-pre rounded border border-sky-500/45 bg-sky-500/10 px-1 text-sky-900 shadow-sm transition-colors hover:bg-sky-500/20 dark:text-sky-100";
const INLINE_GAMEVAL_BUTTON_ALT_CLASS =
  "inline-flex h-[18px] cursor-pointer items-center whitespace-pre rounded border border-amber-500/45 bg-amber-500/10 px-1 text-amber-900 shadow-sm transition-colors hover:bg-amber-500/20 dark:text-amber-100";

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
  interface: IFTYPES,
  iftypes: IFTYPES,
  components: IFTYPES,
  jingles: SOUNDTYPES,
  soundtypes: SOUNDTYPES,
};

type InlineGamevalReference = {
  type: GamevalType;
  group: string;
  name: string;
  raw: string;
};

type EnumDialogState = {
  row: ConfigArchiveTableRow;
  entries: Record<string, string>;
};

function normalizeGamevalDisplay(group: string, name: string, fallback = ""): string {
  const normalizedGroup = group.trim().toLowerCase();
  const normalizedName = name.trim();
  if (!normalizedGroup && !normalizedName) return fallback;
  if (!normalizedName) return normalizedGroup || fallback;
  const prefixed = `${normalizedGroup}.`;
  if (normalizedName.toLowerCase().startsWith(prefixed)) return normalizedName;
  return `${normalizedGroup}.${normalizedName}`;
}

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

function parseInlineGamevalToken(text: string): InlineGamevalReference | null {
  const normalizedText = text.trim().replace(/^['"\s]+|['"\s]+$/g, "");
  const match = /^([a-z][a-z0-9_]*)\.([A-Za-z0-9_:$\/.-]+(?:\s*\++)?)$/i.exec(normalizedText);
  if (!match) return null;
  const group = match[1]?.toLowerCase() ?? "";
  const type = INLINE_GAMEVAL_GROUP_TO_TYPE[group];
  if (!type) return null;
  let name = match[2] ?? "";
  const prefixed = `${group}.`;
  if (name.toLowerCase().startsWith(prefixed)) {
    name = name.slice(prefixed.length);
  }
  return { type, group, name, raw: normalizeGamevalDisplay(group, name, normalizedText) };
}

function resolveInlineGamevalFromText(
  text: string,
  combinedRev: number,
  lookupGamevalByName: (type: GamevalType, name: string, rev?: number | "latest") => number | undefined,
): { ref: InlineGamevalReference; id: number } | null {
  const parsed = parseInlineGamevalToken(text);
  if (!parsed) return null;
  const id = lookupGamevalByName(parsed.type, parsed.name, combinedRev);
  if (id == null) return null;
  return { ref: parsed, id };
}

function renderDialogGamevalChip(opts: {
  text: string;
  combinedRev: number;
  lookupGamevalByName: (type: GamevalType, name: string, rev?: number | "latest") => number | undefined;
  loadGamevalType: (type: GamevalType, rev?: number | "latest") => Promise<void>;
  onOpenRef: (ref: { ref: InlineGamevalReference; id: number }) => void;
  alt?: boolean;
  showTooltip?: boolean;
}) {
  const parsed = parseInlineGamevalToken(opts.text);
  const cleanedText = opts.text.trim().replace(/^['"\s]+|['"\s]+$/g, "");
  if (!parsed) return <span className="font-mono text-xs break-all text-foreground">{cleanedText || "—"}</span>;
  const className = opts.alt ? INLINE_GAMEVAL_BUTTON_ALT_CLASS : INLINE_GAMEVAL_BUTTON_CLASS;
  const label = parsed.raw.trim() || cleanedText;
  const resolvedId = opts.lookupGamevalByName(parsed.type, parsed.name, opts.combinedRev);
  return (
    <button
      type="button"
      className={cn(className, "h-auto min-h-[18px] whitespace-normal break-all")}
      onClick={() => {
        void (async () => {
          let id = resolvedId ?? opts.lookupGamevalByName(parsed.type, parsed.name, opts.combinedRev);
          if (id == null) {
            await opts.loadGamevalType(parsed.type, opts.combinedRev);
            id = opts.lookupGamevalByName(parsed.type, parsed.name, opts.combinedRev);
          }
          if (id != null) opts.onOpenRef({ ref: parsed, id });
        })();
      }}
      title={opts.showTooltip ?? true ? `Open ${parsed.raw}` : undefined}
    >
      <span className="font-mono text-xs">{label}{resolvedId != null ? ` (${resolvedId})` : ""}</span>
    </button>
  );
}

function EnumRowDialog({
  state,
  combinedRev,
  onOpenChange,
  lookupGamevalByName,
  loadGamevalType,
  onOpenRef,
}: {
  state: EnumDialogState | null;
  combinedRev: number;
  onOpenChange: (open: boolean) => void;
  lookupGamevalByName: (type: GamevalType, name: string, rev?: number | "latest") => number | undefined;
  loadGamevalType: (type: GamevalType, rev?: number | "latest") => Promise<void>;
  onOpenRef: (ref: { ref: InlineGamevalReference; id: number }) => void;
}) {
  const { selectedCacheType } = useCacheType();
  const [dialogLines, setDialogLines] = React.useState<ConfigLine[] | null>(null);

  React.useEffect(() => {
    if (!state) {
      setDialogLines(null);
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams({
      type: "enum",
      id: String(state.row.id),
      rev: String(combinedRev),
    });
    const url = `/api/cache-proxy/cache?${params.toString()}`;
    const cacheKey = `cache:enum-dialog:${selectedCacheType.id}:${state.row.id}:${combinedRev}`;

    void (async () => {
      try {
        const { data } = await conditionalJsonFetch<unknown>(cacheKey, url, {
          headers: cacheProxyHeaders(selectedCacheType),
        });
        if (cancelled) return;
        setDialogLines(configLinesFromCachePayload(data, "enum", { includeCommentWithoutHeaderLabel: false }) ?? []);
      } catch {
        if (cancelled) return;
        setDialogLines([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state, combinedRev, selectedCacheType]);

  const parsedDialog = React.useMemo(() => {
    const values: Array<{ index: number; key: string; value: string }> = [];
    let keyType: string | null = null;
    let valueType: string | null = null;
    let defaultValue: string | null = null;

    for (const line of dialogLines ?? []) {
      const text = line.line.trim();
      if (!text || text.startsWith("//") || (text.startsWith("[") && text.endsWith("]"))) continue;
      const eq = text.indexOf("=");
      if (eq <= 0) continue;
      const field = text.slice(0, eq).trim();
      const rhs = text.slice(eq + 1);
      if (field === "key") {
        keyType = rhs;
        continue;
      }
      if (field === "value") {
        valueType = rhs;
        continue;
      }
      if (field === "default") {
        defaultValue = rhs;
        continue;
      }
      const valueMatch = /^value(\d+)$/.exec(field);
      if (!valueMatch) continue;
      const comma = rhs.indexOf(",");
      if (comma === -1) {
        values.push({ index: Number.parseInt(valueMatch[1]!, 10), key: rhs, value: "—" });
      } else {
        values.push({
          index: Number.parseInt(valueMatch[1]!, 10),
          key: rhs.slice(0, comma),
          value: rhs.slice(comma + 1),
        });
      }
    }

    return {
      keyType: keyType ?? state?.entries.key ?? "—",
      valueType: valueType ?? state?.entries.value ?? "—",
      defaultValue: defaultValue ?? state?.entries.default ?? "—",
      values: values.sort((a, b) => a.index - b.index),
    };
  }, [dialogLines, state]);

  return (
    <Dialog open={state != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{state ? `Enum ${state.row.id}` : "Enum"}</DialogTitle>
          <DialogDescription>
            {state ? `Key ${parsedDialog.keyType} · Value ${parsedDialog.valueType} · ${parsedDialog.values.length} entries` : ""}
          </DialogDescription>
        </DialogHeader>
        {state ? (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Key Type</div>
                <div className="mt-1 font-mono text-sm text-foreground">{parsedDialog.keyType}</div>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Value Type</div>
                <div className="mt-1 font-mono text-sm text-foreground">{parsedDialog.valueType}</div>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Default</div>
                <div className="mt-1 min-h-5 text-sm text-foreground">{renderDialogGamevalChip({ text: parsedDialog.defaultValue, combinedRev, lookupGamevalByName, loadGamevalType, onOpenRef, alt: true })}</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border/60 bg-background/90">
              <div className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">{parsedDialog.values.length} enum values</div>
              <div className="max-h-[55vh] overflow-auto">
                <Table>
                  <colgroup>
                    <col className="w-10" />
                    <col className="w-[38%]" />
                    <col />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>#</TableHead>
                      <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Key</TableHead>
                      <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedDialog.values.map(({ index, key, value }) => {
                      return (
                        <TableRow key={`${key}-${index}`} className="border-t align-top">
                          <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono text-xs text-muted-foreground")}>{index}</TableCell>
                          <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                            {renderDialogGamevalChip({ text: key, combinedRev, lookupGamevalByName, loadGamevalType, onOpenRef })}
                          </TableCell>
                          <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                            {renderDialogGamevalChip({ text: value, combinedRev, lookupGamevalByName, loadGamevalType, onOpenRef, alt: true })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
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
  const isObjectRef = displayRef?.ref.type === OBJTYPES;
  const isInterfaceRef = displayRef?.ref.type === IFTYPES;
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
  const interfaceSubRows = React.useMemo(() => {
    if (!displayRef || !isInterfaceRef) return [] as Array<{ childId: number; label: string; combinedId: number }>;
    return subEntries.map((entry) => ({
      childId: entry.id,
      label: entry.value,
      combinedId: interfaceComponentCombinedId(displayRef.id, entry.id),
    }));
  }, [displayRef, isInterfaceRef, subEntries]);

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
      type: normalizeConfigTypeForCacheApi(configType),
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
            {displayRef && (isItemRef || isNpcRef || isObjectRef) ? (
              <div className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded border border-border/60 bg-background/90 p-1">
                {isItemRef ? (
                  <OpenRuneItemImage id={displayRef.id} />
                ) : isNpcRef ? (
                  <OpenRuneNpcImage id={displayRef.id} />
                ) : (
                  <OpenRuneObjectImage id={displayRef.id} />
                )}
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
            ) : isInterfaceRef ? (
              <div className="rounded-md border border-border/60 bg-background/90">
                <div className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  {interfaceSubRows.length} component{interfaceSubRows.length === 1 ? "" : "s"} in interface
                </div>
                {interfaceSubRows.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No component entries in extras for this interface.</div>
                ) : (
                  <div className="max-h-[50vh] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>#</TableHead>
                          <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Name</TableHead>
                          <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {interfaceSubRows.map((row, idx) => (
                          <TableRow key={row.childId} className="border-t align-top">
                            <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono text-xs text-muted-foreground")}>{idx + 1}</TableCell>
                            <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                              <span className="font-mono text-xs">{row.label || "—"}</span>
                            </TableCell>
                            <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono text-xs tabular-nums")}>{row.combinedId}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
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

function splitHoverTarget(rawLine: string): { prefix: string; value: string } | null {
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
}

/** Shared by entity archive views and the combined gamevals explorer text mode. */
export const ArchivePlainTextLine = React.memo(function ArchivePlainTextLine({
  line,
  combinedRev: _combinedRev,
  lookupRevisions,
  hoverText,
  fieldRenderSchemaByField,
  showInline: _showInline,
  pipTooltip = true,
  findKind,
  findQuery,
  findMarkActive,
}: DiffConfigArchiveTextLineProps) {
  const { loadGamevalType, hasLoaded, lookupGameval, lookupGamevalByName, getGamevalExtra } = useGamevals();
  const [openRef, setOpenRef] = React.useState<{ ref: InlineGamevalReference; id: number } | null>(null);
  const candidateRevisions = React.useMemo(() => {
    const out: number[] = [];
    const pushUnique = (n: number) => {
      if (!Number.isFinite(n)) return;
      if (!out.includes(n)) out.push(n);
    };
    for (const n of lookupRevisions ?? []) pushUnique(n);
    pushUnique(_combinedRev);
    return out;
  }, [lookupRevisions, _combinedRev]);

  const resolveGamevalIdByName = React.useCallback(
    (type: GamevalType, name: string): number | undefined => {
      for (const rev of candidateRevisions) {
        const id = lookupGamevalByName(type, name, rev);
        if (id != null) return id;
      }
      return lookupGamevalByName(type, name, _combinedRev);
    },
    [candidateRevisions, lookupGamevalByName, _combinedRev],
  );

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
      for (const rev of candidateRevisions) {
        if (!hasLoaded(type, rev)) {
          void loadGamevalType(type, rev);
        }
      }
    }
  }, [inlineRefTypes, hasLoaded, loadGamevalType, candidateRevisions]);

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
    const id = resolveGamevalIdByName(type, name);
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
      let refIndex = 0;
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
        const id = resolveGamevalIdByName(type, name);
        if (id == null) {
          nodes.push(
            <FindHighlightedText
              key={`ref-plain-${start}`}
              text={raw}
              kind={hl?.kind ?? "literal"}
              query={hl?.query ?? ""}
              enabled={Boolean(hl)}
            />,
          );
          cursor = end;
          continue;
        }
        const buttonClass = refIndex % 2 === 0 ? INLINE_GAMEVAL_BUTTON_CLASS : INLINE_GAMEVAL_BUTTON_ALT_CLASS;
        const displayLabel = `${raw}${id != null ? ` (${id})` : ""}`;
        nodes.push(
          <button
            key={`ref-${start}`}
            type="button"
            className={buttonClass}
            onClick={() => setOpenRef({ ref: { type, group, name, raw }, id })}
            title={pipTooltip ? `Open ${raw}` : undefined}
          >
            <FindHighlightedText
              text={displayLabel}
              kind={hl?.kind ?? "literal"}
              query={hl?.query ?? ""}
              enabled={Boolean(hl)}
            />
          </button>,
        );
        refIndex += 1;
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
    [hl?.kind, hl?.query, resolveGamevalIdByName, pipTooltip],
  );

  const fn = getFieldName(line);
  const schemaKind = fn ? resolveFieldSchemaKind(fieldRenderSchemaByField, fn) : null;
  const colorKind =
    schemaKind === "colour"
      ? (fn != null && fn.toLowerCase().includes("rgb") ? "rgb" : "hsl")
      : null;
  const textureField = fn != null && schemaKind === "texture";
  const spriteField = fn != null && schemaKind === "sprite";
  if (fn && (colorKind || textureField || spriteField)) {
    const displayLine = displayTextureFieldLine(line);
    const eqIdx = displayLine.indexOf("=");
    const prefix = displayLine.slice(0, eqIdx + 1);
    const rest = displayLine.slice(eqIdx + 1);
    const hlKind = hl?.kind ?? "literal";
    const hlQuery = hl?.query ?? "";
    const hlEnabled = Boolean(hl);
    const isArray = isArrayValue(rest);
    const valueParts: React.ReactNode[] = [];
    const re = /([a-z][a-z0-9_]*\.[A-Za-z0-9_:$\/-]+(?:\s*\++)?)|(-?\d+)/gi;
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
      const token = m[1] ?? m[2] ?? "";
      let widgetValue: number | null = null;
      let spriteGamevalId: number | null = null;
      if (m[2] != null) {
        const n = Number(m[2]);
        widgetValue = Number.isFinite(n) ? n : null;
      } else if (m[1] != null) {
        const parsed = parseInlineGamevalToken(m[1]);
        if (parsed) {
          const id = resolveGamevalIdByName(parsed.type, parsed.name);
          if (id != null) {
            if (spriteField) spriteGamevalId = id;
            else widgetValue = id;
          }
        }
      }
      const widget = widgetValue != null
        ? colorKind ? (
            <RsColorSwatch key={`sw${m.index}`} value={widgetValue} kind={colorKind} />
          ) : textureField ? (
            <RsTextureSwatch key={`sw${m.index}`} value={widgetValue} combinedRev={_combinedRev} />
          ) : spriteField ? (
            <RsSpriteSwatch key={`sw${m.index}`} value={widgetValue} combinedRev={_combinedRev} />
          ) : null
        : null;
      if (isArray && widget) valueParts.push(widget);
      if (spriteField && m[1] != null && spriteGamevalId != null) {
        const parsed = parseInlineGamevalToken(m[1])!;
        const buttonClass = INLINE_GAMEVAL_BUTTON_CLASS;
        const displayLabel = `${parsed.raw} (${spriteGamevalId})`;
        valueParts.push(
          <button
            key={`gv${m.index}`}
            type="button"
            className={buttonClass}
            onClick={() => setOpenRef({ ref: parsed, id: spriteGamevalId! })}
            title={pipTooltip ? `Open ${parsed.raw}` : undefined}
          >
            <FindHighlightedText text={displayLabel} kind={hlKind} query={hlQuery} enabled={hlEnabled} />
          </button>,
          <RsSpriteSwatch key={`sw${m.index}`} value={spriteGamevalId} combinedRev={_combinedRev} />,
        );
      } else {
        valueParts.push(
          <FindHighlightedText key={`n${m.index}`} text={token} kind={hlKind} query={hlQuery} enabled={hlEnabled} />,
        );
        if (!isArray && widget) valueParts.push(widget);
      }
      last = m.index + token.length;
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
    const hasInlineGamevals = findInlineGamevalReferences(mainValue).length > 0;
    return (
      <>
        <span className="whitespace-pre">
          <FindHighlightedText
            text={split.prefix}
            kind={hl?.kind ?? "literal"}
            query={hl?.query ?? ""}
            enabled={Boolean(hl)}
          />
          {hasInlineGamevals
            ? renderTextWithInlineGamevals(mainValue)
            : wrapHoverValue(renderTextWithInlineGamevals(mainValue), resolveHoverTextId(hoverText ?? "", mainValue))}
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

const ENTITY_META_OVERRIDES: Partial<Record<ArchiveEntitySection, EntityMeta>> = {
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
  objects: {
    title: "Objects",
    tableEntitySingular: "object",
    tableEntityPlural: "objects",
    paginationCountLabel: "objects",
    emptyTableMessage: "No object rows for this revision (or no matches).",
    decodingMessage: "Object data is still decoding on the cache server. Try again in a moment.",
    tableErrorVerb: "load objects table",
    contentErrorVerb: "load objects content",
    gamevalFilterErrorVerb: "filter objects by gameval",
    searchHint: "Objects: ID, gameval (objects), name substring, or regex.",
    gamevalType: OBJTYPES,
    suggestionEnabled: (d) => d.objects,
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
  param: {
    title: "Parameters",
    tableEntitySingular: "parameter",
    tableEntityPlural: "parameters",
    paginationCountLabel: "parameters",
    emptyTableMessage: "No parameter rows for this revision (or no matches).",
    decodingMessage: "Parameter data is still decoding on the cache server. Try again in a moment.",
    tableErrorVerb: "load parameters table",
    contentErrorVerb: "load parameters content",
    gamevalFilterErrorVerb: "filter parameters",
    searchHint: "Parameters: use ID or name substring (type, ismembers).",
    gamevalType: null,
    suggestionEnabled: () => false,
  },
};

function titleCaseSection(section: string): string {
  return section
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function defaultEntityMeta(section: ArchiveEntitySection): EntityMeta {
  const label = titleCaseSection(section);
  return {
    title: label,
    tableEntitySingular: section,
    tableEntityPlural: `${section}s`,
    paginationCountLabel: `${section}s`,
    emptyTableMessage: `No ${section} rows for this revision (or no matches).`,
    decodingMessage: `${label} data is still decoding on the cache server. Try again in a moment.`,
    tableErrorVerb: `load ${section} table`,
    contentErrorVerb: `load ${section} content`,
    gamevalFilterErrorVerb: `filter ${section}`,
    searchHint: `${label}: use ID or gameval where available.`,
    gamevalType: null,
    suggestionEnabled: () => true,
  };
}

export type DiffConfigArchiveEntityViewProps = {
  section: ArchiveEntitySection;
  sectionLabel?: string;
  diffViewMode: DiffMode;
  combinedRev: number;
  baseRev: number;
  rev: number;
};

export function DiffConfigArchiveEntityView({
  section,
  sectionLabel,
  diffViewMode,
  combinedRev,
  baseRev,
  rev,
}: DiffConfigArchiveEntityViewProps) {
  const meta = React.useMemo(() => {
    const baseMeta = ENTITY_META_OVERRIDES[section] ?? defaultEntityMeta(section);
    const trimmedLabel = sectionLabel?.trim();
    if (!trimmedLabel) return baseMeta;
    const labelLower = trimmedLabel.toLowerCase();
    return {
      ...baseMeta,
      title: trimmedLabel,
      tableEntitySingular: labelLower,
      tableEntityPlural: labelLower,
      paginationCountLabel: labelLower,
      emptyTableMessage: `No ${labelLower} rows for this revision (or no matches).`,
      decodingMessage: `${trimmedLabel} data is still decoding on the cache server. Try again in a moment.`,
      tableErrorVerb: `load ${labelLower} table`,
      contentErrorVerb: `load ${labelLower} content`,
      gamevalFilterErrorVerb: `filter ${labelLower}`,
      searchHint: `${trimmedLabel}: use ID or gameval where available.`,
    };
  }, [section, sectionLabel]);
  const { selectedCacheType } = useCacheType();
  const { lookupGameval, lookupGamevalByName, loadGamevalType, hasLoaded, getGamevalExtra } = useGamevals();
  const sectionGamevalType = sectionGamevalTypeForSection(section) ?? meta.gamevalType;
  const [schemaHasGameval, setSchemaHasGameval] = React.useState<boolean | undefined>(undefined);
  const useGamevalColumn = schemaHasGameval ?? (sectionGamevalType != null);
  const showImageCol = section === "items" || section === "npcs" || section === "objects";

  const [openRef, setOpenRef] = React.useState<{ ref: InlineGamevalReference; id: number } | null>(null);
  const [openEnumRow, setOpenEnumRow] = React.useState<EnumDialogState | null>(null);
  const [fieldRenderSchemaByField, setFieldRenderSchemaByField] = React.useState<Record<string, ConfigFieldRenderSchema>>({});
  const [tableColumnPreferences, setTableColumnPreferences] = React.useState<TableColumnPreference[]>([]);
  const [tableSearchFieldByMode, setTableSearchFieldByMode] = React.useState<Partial<Record<"name" | "regex", string>>>({});

  React.useEffect(() => {
    let cancelled = false;
    const configType = section;
    const url = diffConfigSchemaUrl(configType);
    const cacheKey = `diff:config:schema:${selectedCacheType.id}:${configType}`;

    const run = async () => {
      try {
        const { data } = await conditionalJsonFetch<unknown>(cacheKey, url, {
          headers: cacheProxyHeaders(selectedCacheType),
        });
        if (cancelled) return;
        const parsed = parseFieldRenderSchemaPayload(data);
        setFieldRenderSchemaByField(parsed.fields);
        setTableColumnPreferences(parsed.tableColumns);
        setTableSearchFieldByMode(parsed.searchFieldByMode);
        setSchemaHasGameval(parsed.hasGameval);
      } catch {
        if (cancelled) return;
        setFieldRenderSchemaByField({});
        setTableColumnPreferences([]);
        setTableSearchFieldByMode({});
        setSchemaHasGameval(undefined);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [section, selectedCacheType]);

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

  // Eagerly load all known gameval types so chips in text view and tables are immediately clickable.
  React.useEffect(() => {
    for (const type of Object.values(GAMEVAL_TYPE_MAP)) {
      if (!hasLoaded(type, combinedRev)) {
        void loadGamevalType(type, combinedRev);
      }
    }
  }, [combinedRev, hasLoaded, loadGamevalType]);

  const openGamevalTextRef = React.useCallback(
    async (text: string, revArg: number) => {
      const parsed = parseInlineGamevalToken(text);
      if (!parsed) return null;
      let id = lookupGamevalByName(parsed.type, parsed.name, revArg);
      if (id == null) {
        await loadGamevalType(parsed.type, revArg);
        id = lookupGamevalByName(parsed.type, parsed.name, revArg);
      }
      if (id == null) return null;
      const resolved = { ref: parsed, id };
      setOpenRef(resolved);
      return resolved;
    },
    [lookupGamevalByName, loadGamevalType],
  );

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
      const keys = openruneEntityArchiveColumnKeys(
        section,
        displayRows.length > 0 ? displayRows : [],
        revArg,
        useGamevalColumn,
        tableColumnPreferences,
      );
      const gvType = sectionGamevalType;
      const colCount = keys.length + (showImageCol ? 1 : 0);

      return {
        colgroup: (
          <colgroup>
            <col className="w-16" />
            {showImageCol ? (
              <col className={section === "items" ? "w-12" : "w-14"} />
            ) : null}
            {keys.map((colKey) => (
              <col key={colKey} className={colKey === "gameval" ? "min-w-[10rem]" : colKey === "tickDuration" ? "w-36" : colKey === "animationId" ? "min-w-[8rem]" : colKey === "key" || colKey === "value" ? "w-20" : colKey === "model" ? "min-w-[10rem]" : "min-w-[6rem]"} />
            ))}
          </colgroup>
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
          const enumClickable = section === "enum";
          return (
            <TableRow
              key={row.id}
              className={cn("border-t align-top hover:bg-muted/35", enumClickable && "cursor-pointer")}
              onClick={enumClickable ? () => setOpenEnumRow({ row, entries }) : undefined}
              onKeyDown={enumClickable ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenEnumRow({ row, entries });
                }
              } : undefined}
              role={enumClickable ? "button" : undefined}
              tabIndex={enumClickable ? 0 : undefined}
            >
              <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono")}>{row.id}</TableCell>
              {showImageCol ? (
                <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, section === "items" ? "p-1" : "p-2")}>
                  <div
                    className={cn(
                      "inline-flex shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30",
                      section === "items" ? "h-8 w-8 p-0.5" : "h-12 w-12 p-1",
                    )}
                  >
                    {section === "items" ? (
                      <OpenRuneItemImage id={row.id} />
                    ) : section === "npcs" ? (
                      <OpenRuneNpcImage id={row.id} />
                    ) : (
                      <OpenRuneObjectImage id={row.id} />
                    )}
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
                if (key === "default") {
                  const rawDefault = entries.default ?? "";
                  const parsedDefault = resolveInlineGamevalFromText(rawDefault, revArg, lookupGamevalByName);
                  if (parsedDefault != null || parseInlineGamevalToken(rawDefault) != null) {
                    return (
                      <TableCell key={key} className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                        <button
                          type="button"
                          className={TABLE_GAMEVAL_BUTTON_CLASS}
                          onClick={(e) => {
                            e.stopPropagation();
                            void openGamevalTextRef(rawDefault, revArg);
                          }}
                          title={`Open ${(parsedDefault?.ref.raw ?? parseInlineGamevalToken(rawDefault)?.raw) ?? rawDefault}`}
                        >
                          <span className="block max-w-[12rem] truncate">{(parsedDefault?.ref.raw ?? parseInlineGamevalToken(rawDefault)?.raw ?? rawDefault).trim().replace(/^['"\s]+|['"\s]+$/g, "")}{parsedDefault != null ? ` (${parsedDefault.id})` : ""}</span>
                        </button>
                      </TableCell>
                    );
                  }
                }
                if (key === "default" && section === "param") {
                  const selectedDefaultField = getParamSmartDefaultField(entries);
                  const rawSelected = row.entriesRaw?.[selectedDefaultField];

                  let group: string | null = null;
                  let name: string | null = null;
                  let rawValue: string | null = null;

                  if (rawSelected && typeof rawSelected === "object" && !Array.isArray(rawSelected)) {
                    const rs = rawSelected as Record<string, unknown>;
                    rawValue = rs.value != null ? String(rs.value) : null;
                    const ref = rs.ref;
                    if (ref && typeof ref === "object") {
                      const rr = ref as Record<string, unknown>;
                      group = typeof rr.group === "string" ? rr.group : null;
                      name = typeof rr.name === "string" ? rr.name : null;
                    }
                  }

                  const fallback = (entries.default ?? "").trim().replace(/^['"\s]+|['"\s]+$/g, "");
                  if ((!group || !name) && fallback.includes(".")) {
                    const dot = fallback.indexOf(".");
                    const g = fallback.slice(0, dot).trim();
                    const n = fallback.slice(dot + 1).trim();
                    if (g && n) {
                      group = g;
                      name = n;
                    }
                  }

                  if (group && name) {
                    const refType = INLINE_GAMEVAL_GROUP_TO_TYPE[group.toLowerCase()];
                    const resolvedIdByName = refType ? lookupGamevalByName(refType, name, revArg) : undefined;
                    const resolvedIdByUpper =
                      refType && resolvedIdByName == null ? lookupGamevalByName(refType, name.toUpperCase(), revArg) : undefined;
                    const rawNumericId = rawValue != null && /^-?\d+$/.test(rawValue.trim())
                      ? Number(rawValue)
                      : undefined;
                    const selectedEntryRaw = entries[selectedDefaultField];
                    const selectedEntryNumericId =
                      selectedEntryRaw != null && /^-?\d+$/.test(selectedEntryRaw.trim())
                        ? Number(selectedEntryRaw)
                        : undefined;
                    const resolvedId = resolvedIdByName ?? resolvedIdByUpper ?? rawNumericId ?? selectedEntryNumericId;

                    if (refType && resolvedId != null && Number.isFinite(resolvedId)) {
                      const label = name;
                      const openLabel = `${group}.${name}`;
                      return (
                        <TableCell key={key} className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                          <button
                            type="button"
                            className={TABLE_GAMEVAL_BUTTON_CLASS}
                            onClick={() =>
                              setOpenRef({
                                ref: { type: refType, group, name, raw: rawValue ?? String(resolvedId) },
                                id: resolvedId,
                              })
                            }
                            title={`Open ${openLabel} (${resolvedId})`}
                          >
                            <span className="block max-w-[12rem] truncate">{label} ({resolvedId})</span>
                          </button>
                        </TableCell>
                      );
                    }
                  }
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
                    onOpenRef={(ref) => setOpenRef(ref)}
                    pipTooltip
                    fieldRenderSchemaByField={fieldRenderSchemaByField}
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
    [lookupGameval, lookupGamevalByName, getGamevalExtra, sectionGamevalType, meta.tableEntityPlural, meta.title, rowEntriesForCell, section, setOpenRef, showImageCol, fieldRenderSchemaByField, tableColumnPreferences, useGamevalColumn],
  );

  const tableSearchDisabledModes = React.useMemo((): readonly DiffSearchFieldMode[] => {
    const hasNameField = typeof tableSearchFieldByMode.name === "string" && tableSearchFieldByMode.name.trim().length > 0;
    const hasRegexField = typeof tableSearchFieldByMode.regex === "string" && tableSearchFieldByMode.regex.trim().length > 0;
    const disabled: DiffSearchFieldMode[] = [];
    if (!useGamevalColumn) {
      disabled.push("gameval");
    } else if (combinedRev < GAMEVAL_MIN_REVISION) {
      disabled.push("gameval");
    }
    if (!hasNameField) disabled.push("name");
    if (!hasRegexField) disabled.push("regex");
    return disabled;
  }, [combinedRev, tableSearchFieldByMode.name, tableSearchFieldByMode.regex, useGamevalColumn]);

  const tableSearchModeTitles = React.useMemo(() => {
    const revHint = `Needs revision ${GAMEVAL_MIN_REVISION}+ (current ${combinedRev}).`;
    const hasNameField = typeof tableSearchFieldByMode.name === "string" && tableSearchFieldByMode.name.trim().length > 0;
    const hasRegexField = typeof tableSearchFieldByMode.regex === "string" && tableSearchFieldByMode.regex.trim().length > 0;
    return {
      gameval: useGamevalColumn ? (combinedRev < GAMEVAL_MIN_REVISION ? revHint : meta.searchHint) : meta.searchHint,
      name: hasNameField ? `Substring match on field '${tableSearchFieldByMode.name}'.` : "Name search is disabled for this table.",
      regex: hasRegexField ? `Regex match on field '${tableSearchFieldByMode.regex}'.` : "Regex search is disabled for this table.",
    } as const;
  }, [combinedRev, meta.searchHint, tableSearchFieldByMode.name, tableSearchFieldByMode.regex, useGamevalColumn]);

  const gamevalAutocomplete =
    sectionGamevalType != null
      ? {
          type: sectionGamevalType,
          revUsesCombined: true as const,
          enabled: meta.suggestionEnabled,
        }
      : null;

  const gamevalBulkFilter =
    sectionGamevalType != null
      ? {
          filterGamevalType: sectionGamevalType,
          rowToFilterId: (row: ConfigArchiveTableRow) => row.id,
          bulkPageSize: GAMEVAL_BULK_PAGE,
          preloadTypes: [sectionGamevalType],
          readyWhenLoaded: sectionGamevalType,
        }
      : null;

  const TextLineWithSchema = React.useMemo<React.ComponentType<DiffConfigArchiveTextLineProps>>(
    () => function TextLineWithSchema(props) {
      return <ArchivePlainTextLine {...props} fieldRenderSchemaByField={fieldRenderSchemaByField} />;
    },
    [fieldRenderSchemaByField],
  );

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
      tableSearch={{
        disabledModes: tableSearchDisabledModes,
        modeTitles: tableSearchModeTitles,
        searchFieldByMode: tableSearchFieldByMode,
      }}
      gamevalAutocomplete={gamevalAutocomplete}
      gamevalBulkFilter={gamevalBulkFilter}
      buildTablePlan={buildTablePlan}
        TextLine={TextLineWithSchema}
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
      <EnumRowDialog
        state={openEnumRow}
        combinedRev={combinedRev}
        onOpenChange={(open) => {
          if (!open) setOpenEnumRow(null);
        }}
        lookupGamevalByName={lookupGamevalByName}
        loadGamevalType={loadGamevalType}
        onOpenRef={(ref) => setOpenRef(ref)}
      />
    </>
  );
}
