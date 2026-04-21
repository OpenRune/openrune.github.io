import type * as React from "react";

import type { GamevalType } from "@/context/gameval-context";
import type { AppSettings } from "@/context/settings-context";
import type { DiffMode, DiffSearchFieldMode, SearchTag } from "./diff-types";

export type ConfigFieldRenderKind = "raw" | "gameval" | "sprite" | "texture" | "colour";

export type ConfigFieldRenderSchema = {
  kind: ConfigFieldRenderKind;
};

/** Server config table row (`diff/config/{type}/table`). */
export type ConfigArchiveTableRow = {
  id: number;
  sectionId?: string;
  entries: Record<string, string>;
  /** Raw server field values (preserves `{ value, ref }` gameval objects when present). */
  entriesRaw?: Record<string, unknown>;
};

export type DiffConfigArchiveTextLineProps = {
  line: string;
  combinedRev: number;
  /** Optional revision candidates for gameval name lookup (diff mode can include base+compare). */
  lookupRevisions?: readonly number[];
  hoverText?: string;
  fieldRenderSchemaByField?: Record<string, ConfigFieldRenderSchema>;
  /** Optional (e.g. texture inline previews from settings). */
  showInline?: boolean;
  /** Show hover tooltip on pip buttons. Defaults to true. */
  pipTooltip?: boolean;
  findKind?: "literal" | "regex";
  findQuery?: string;
  findMarkActive?: boolean;
};

export type DiffConfigArchiveGamevalBulkFilter = {
  /** Gameval API type used for tag / substring matching (e.g. SPRITETYPES for texture `fileId`). */
  filterGamevalType: GamevalType;
  /** Row → id passed to `matchesSpriteGamevalTags` / `spriteMatchesSubstringName`. */
  rowToFilterId: (row: ConfigArchiveTableRow) => number | null;
  bulkPageSize?: number;
  /** `loadGamevalType` for each (defaults to `[filterGamevalType]`). */
  preloadTypes?: readonly GamevalType[];
  /** `hasLoaded(type, rev)` must be true before bulk filter runs (defaults to `filterGamevalType`). */
  readyWhenLoaded?: GamevalType;
};

export type DiffConfigArchiveGamevalAutocomplete = {
  type: GamevalType;
  revUsesCombined: true;
  enabled: (display: AppSettings["suggestionDisplay"]) => boolean;
  /** When true, load combined sprite ids and pass as `allowedIds` (texture gameval UX). */
  restrictToCombinedSpriteIds?: boolean;
};

export type DiffConfigArchiveTablePlan = {
  colgroup: React.ReactNode;
  /** `<TableHead>` cells after the ID column. */
  headerCellsAfterId: React.ReactNode;
  /** Full `<TableRow key={row.id}>…</TableRow>` including the ID cell. */
  renderTableRow: (row: ConfigArchiveTableRow) => React.ReactNode;
  /** Skeleton rows (each should be a `<TableRow>…</TableRow>`). */
  renderSkeletonRows: (perPage: number) => React.ReactNode;
  emptyColSpan: number;
  loadingAriaLabel: string;
  readyAriaLabel: string;
};

export type DiffConfigArchiveLabels = {
  /** e.g. `texture` / `textures` for headline */
  tableEntitySingular: string;
  tableEntityPlural: string;
  textLineSingular?: string;
  textLinePlural?: string;
  paginationCountLabel: string;
  emptyTableMessage: string;
  decodingMessage: string;
  tableErrorVerb: string;
  contentErrorVerb: string;
  gamevalFilterErrorVerb: string;
};

export type DiffConfigArchiveViewProps = {
  diffViewMode: DiffMode;
  combinedRev: number;
  baseRev: number;
  rev: number;

  /** `diff/config/{configType}/…` */
  configType: string;
  tableBase?: number;

  title: string;
  labels: DiffConfigArchiveLabels;

  tableSearch: {
    disabledModes: readonly DiffSearchFieldMode[];
    modeTitles: Partial<Record<DiffSearchFieldMode, string>>;
    searchFieldByMode?: Partial<Record<"name" | "regex", string>>;
    tagModes?: readonly ("gameval")[];
  };

  gamevalAutocomplete: DiffConfigArchiveGamevalAutocomplete | null;
  /** Client-side bulk fetch + filter when gameval search has tags or text (e.g. textures by sprite). */
  gamevalBulkFilter: DiffConfigArchiveGamevalBulkFilter | null;

  /** Built each render with current table page / filtered slice (e.g. inv column keys from row keys). */
  buildTablePlan: (ctx: {
    displayRows: ConfigArchiveTableRow[];
    combinedRev: number;
  }) => DiffConfigArchiveTablePlan;

  /** Virtualized text view line */
  TextLine: React.ComponentType<DiffConfigArchiveTextLineProps>;
  /** Row height (px) for text virtualization */
  textRowHeight: number | ((settings: AppSettings) => number);
  /** Passed into `TextLine` when set (e.g. texture inline widgets). */
  getTextLineShowInline?: (settings: AppSettings) => boolean;
  textOverscan?: number;
  textFindDebounceMs?: number;
  /** Shown on the search row, aligned to the far right (e.g. zip download). */
  searchRowTrailing?: React.ReactNode;
  /** Optional search control size for table mode. */
  tableSearchSize?: "default" | "large";
  /** Optional wrapper classes for table-mode search container width/layout. */
  tableSearchWrapClassName?: string;
};
