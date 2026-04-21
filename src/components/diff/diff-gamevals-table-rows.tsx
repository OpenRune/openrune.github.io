"use client";

import * as React from "react";

import { TableCell, TableRow } from "@/components/ui/table";
import type { GamevalEntry } from "@/context/gameval-context";
import { useSettings } from "@/context/settings-context";
import { onCopyApplyGamevalUppercaseSetting } from "@/lib/gameval-clipboard";
import { cn } from "@/lib/utils";

import { DIFF_ARCHIVE_TABLE_CELL_CLASS, DIFF_ARCHIVE_TABLE_ROW_CLASS } from "./diff-table-archive-styles";

export const GamevalsInterfaceComponentRow = React.memo(function GamevalsInterfaceComponentRow({
  combinedId,
  interfaceId,
  displayText,
}: {
  combinedId: number;
  interfaceId: number;
  displayText: string;
}) {
  const { settings } = useSettings();
  return (
    <TableRow className={DIFF_ARCHIVE_TABLE_ROW_CLASS}>
      <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono tabular-nums")}>{combinedId}</TableCell>
      <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono tabular-nums")}>{interfaceId}</TableCell>
      <TableCell
        className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "min-w-0 break-words font-mono text-xs")}
        data-col-key="gameval"
        onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)}
      >
        {displayText}
      </TableCell>
    </TableRow>
  );
});

export const GamevalsDbColumnRow = React.memo(function GamevalsDbColumnRow({
  combinedId,
  tableId,
  displayText,
}: {
  combinedId: number;
  tableId: number;
  displayText: string;
}) {
  const { settings } = useSettings();
  return (
    <TableRow className={DIFF_ARCHIVE_TABLE_ROW_CLASS}>
      <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono tabular-nums")}>{combinedId}</TableCell>
      <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono tabular-nums")}>{tableId}</TableCell>
      <TableCell
        className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "min-w-0 break-words font-mono text-xs")}
        data-col-key="gameval"
        onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)}
      >
        {displayText}
      </TableCell>
    </TableRow>
  );
});

export const GamevalsTwoColEntryRow = React.memo(function GamevalsTwoColEntryRow({
  entry,
  onActivate,
}: {
  entry: GamevalEntry;
  onActivate?: (e: GamevalEntry) => void;
}) {
  const { settings } = useSettings();
  const clickable = Boolean(onActivate);
  return (
    <TableRow
      className={cn(DIFF_ARCHIVE_TABLE_ROW_CLASS, clickable && "cursor-pointer select-none")}
      onClick={onActivate ? () => onActivate(entry) : undefined}
    >
      <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono tabular-nums")}>{entry.id}</TableCell>
      <TableCell
        className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "min-w-0 break-words font-mono text-xs")}
        data-col-key="gameval"
        onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)}
      >
        {entry.name || "—"}
      </TableCell>
    </TableRow>
  );
});
