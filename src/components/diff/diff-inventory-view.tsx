"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { INVTYPES, useGamevals } from "@/context/gameval-context";
import { useSettings } from "@/context/settings-context";
import { onCopyApplyGamevalUppercaseSetting } from "@/lib/gameval-clipboard";
import { cn } from "@/lib/utils";

import { DiffConfigArchiveView } from "./diff-config-archive-view";
import type { ConfigArchiveTableRow, DiffConfigArchiveTextLineProps } from "./diff-config-archive-types";
import { GAMEVAL_MIN_REVISION } from "./diff-constants";
import { openruneColumnHeaderLabel, openruneInvArchiveColumnKeys } from "./diff-openrune-archive-columns";
import type { DiffMode, DiffSearchFieldMode } from "./diff-types";
import { DIFF_ARCHIVE_TABLE_CELL_CLASS, DIFF_ARCHIVE_TABLE_HEAD_CLASS } from "./diff-table-archive-styles";

const INV_CONFIG_TYPE = "inv";
const TABLE_BASE = 1;
const INV_GAMEVAL_BULK_PAGE = 500;
const INV_TEXT_LINE_HEIGHT = 28;

type DiffInventoryViewProps = {
  diffViewMode: DiffMode;
  combinedRev: number;
  baseRev: number;
  rev: number;
};

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

const INV_FIND_MARK_CLASS =
  "rounded-[2px] bg-yellow-300/90 px-0.5 font-mono text-sm font-normal not-italic text-foreground dark:bg-yellow-500/45";

const InvFindHighlightedText = React.memo(function InvFindHighlightedText({
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
          <mark key={i} className={INV_FIND_MARK_CLASS}>
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
});

const InventoryArchiveTableRow = React.memo(function InventoryArchiveTableRow({
  row,
  keys,
  revArg,
  lookupGameval,
  getGamevalExtra,
  copyGamevalsToUppercase,
}: {
  row: ConfigArchiveTableRow;
  keys: string[];
  revArg: number;
  lookupGameval: ReturnType<typeof useGamevals>["lookupGameval"];
  getGamevalExtra: ReturnType<typeof useGamevals>["getGamevalExtra"];
  copyGamevalsToUppercase: boolean;
}) {
  return (
    <TableRow className="border-t align-top hover:bg-muted/35">
      <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono")}>{row.id}</TableCell>
      {keys.map((key) => {
        if (key === "gameval" && revArg >= GAMEVAL_MIN_REVISION) {
          const derived =
            lookupGameval(INVTYPES, row.id, revArg)?.trim() ||
            getGamevalExtra(INVTYPES, row.id, revArg)?.searchable?.trim() ||
            row.entries.gameval?.trim() ||
            "";
          return (
            <TableCell
              key={key}
              className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "text-muted-foreground")}
              data-col-key="gameval"
              onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, copyGamevalsToUppercase)}
            >
              {derived || "—"}
            </TableCell>
          );
        }
        const cell = row.entries[key] ?? "—";
        return (
          <TableCell key={key} className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "text-xs")}>
            {cell}
          </TableCell>
        );
      })}
    </TableRow>
  );
});

const DiffInvTextLine = React.memo(function DiffInvTextLine({
  line,
  combinedRev: _combinedRev,
  showInline: _showInline,
  findKind,
  findQuery,
  findMarkActive,
}: DiffConfigArchiveTextLineProps) {
  const hl =
    findMarkActive && findQuery?.trim()
      ? { kind: findKind ?? "literal", query: findQuery.trim(), active: true as const }
      : null;
  return (
    <span className="whitespace-pre">
      <InvFindHighlightedText
        text={line || " "}
        kind={hl?.kind ?? "literal"}
        query={hl?.query ?? ""}
        enabled={Boolean(hl)}
      />
    </span>
  );
});

export function DiffInventoryView({ diffViewMode, combinedRev, baseRev, rev }: DiffInventoryViewProps) {
  const { lookupGameval, getGamevalExtra } = useGamevals();
  const { settings } = useSettings();

  const buildTablePlan = React.useCallback(
    ({ displayRows, combinedRev: revArg }: { displayRows: ConfigArchiveTableRow[]; combinedRev: number }) => {
      const keys = openruneInvArchiveColumnKeys(displayRows.length > 0 ? displayRows : [], revArg);
      return {
        colgroup: (
          <>
            {keys.map((colKey) => (
              <col key={colKey} className={colKey === "gameval" ? "min-w-[10rem]" : "min-w-[6rem]"} />
            ))}
          </>
        ),
        headerCellsAfterId: (
          <>
            {keys.map((key) => (
              <TableHead key={key} className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>
                {openruneColumnHeaderLabel(key)}
              </TableHead>
            ))}
          </>
        ),
        renderTableRow: (row: ConfigArchiveTableRow) => (
          <InventoryArchiveTableRow
            key={row.id}
            row={row}
            keys={keys}
            revArg={revArg}
            lookupGameval={lookupGameval}
            getGamevalExtra={getGamevalExtra}
            copyGamevalsToUppercase={settings.copyGamevalsToUppercase}
          />
        ),
        renderSkeletonRows: (perPage: number) =>
          Array.from({ length: perPage }, (_, i) => (
            <TableRow key={`inv-sk-${i}`} className="border-t align-top hover:bg-transparent">
              <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                <Skeleton className="h-4 w-10" delayMs={Math.min(i, 24) * 18} shimmer={false} />
              </TableCell>
              {keys.map((_, j) => (
                <TableCell key={j} className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                  <Skeleton className="h-4 w-20" delayMs={Math.min(i, 24) * 18 + 10 + j * 6} shimmer={false} />
                </TableCell>
              ))}
            </TableRow>
          )),
        emptyColSpan: Math.max(1, 1 + keys.length),
        loadingAriaLabel: "Loading inventory table",
        readyAriaLabel: "Inventory table",
      };
    },
    [lookupGameval, getGamevalExtra, settings.copyGamevalsToUppercase],
  );

  const tableSearchDisabledModes = React.useMemo((): readonly DiffSearchFieldMode[] => {
    const invOnly: DiffSearchFieldMode[] = ["name", "regex"];
    if (combinedRev < GAMEVAL_MIN_REVISION) return ["gameval", ...invOnly];
    return invOnly;
  }, [combinedRev]);

  const tableSearchModeTitles = React.useMemo(() => {
    const invOnly = "Inventory: use ID or Gameval (inv) only.";
    const revHint = `Needs revision ${GAMEVAL_MIN_REVISION}+ (current ${combinedRev}).`;
    if (combinedRev < GAMEVAL_MIN_REVISION) {
      return {
        gameval: revHint,
        name: invOnly,
        regex: invOnly,
      } as const;
    }
    return { name: invOnly, regex: invOnly } as const;
  }, [combinedRev]);

  return (
    <DiffConfigArchiveView
      diffViewMode={diffViewMode}
      combinedRev={combinedRev}
      baseRev={baseRev}
      rev={rev}
      configType={INV_CONFIG_TYPE}
      tableBase={TABLE_BASE}
      title="Inventory"
      labels={{
        tableEntitySingular: "inventory",
        tableEntityPlural: "inventories",
        textLineSingular: "line",
        textLinePlural: "lines",
        paginationCountLabel: "inventories",
        emptyTableMessage: "No inventory rows for this revision (or no matches).",
        decodingMessage: "Inventory data is still decoding on the cache server. Try again in a moment.",
        tableErrorVerb: "load inventory table",
        contentErrorVerb: "load inventory content",
        gamevalFilterErrorVerb: "filter inventories by gameval",
      }}
      tableSearch={{ disabledModes: tableSearchDisabledModes, modeTitles: tableSearchModeTitles }}
      gamevalAutocomplete={{
        type: INVTYPES,
        revUsesCombined: true,
        enabled: (d) => d.objects,
      }}
      gamevalBulkFilter={{
        filterGamevalType: INVTYPES,
        rowToFilterId: (row) => row.id,
        bulkPageSize: INV_GAMEVAL_BULK_PAGE,
        preloadTypes: [INVTYPES],
        readyWhenLoaded: INVTYPES,
      }}
      buildTablePlan={buildTablePlan}
      TextLine={DiffInvTextLine}
      textRowHeight={INV_TEXT_LINE_HEIGHT}
    />
  );
}
