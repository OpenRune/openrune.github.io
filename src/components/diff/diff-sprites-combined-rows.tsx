"use client";

import * as React from "react";

import { LazyWhenVisible } from "@/components/ui/lazy-when-visible";
import { RSSprite } from "@/components/ui/RSSprite";
import { useSettings } from "@/context/settings-context";
import { onCopyApplyGamevalUppercaseSetting } from "@/lib/gameval-clipboard";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
  DIFF_ARCHIVE_TABLE_CELL_CLASS,
  DIFF_ARCHIVE_TABLE_ROW_INTERACTIVE_CLASS,
} from "./diff-table-archive-styles";

type CombinedSpriteGridTileProps = {
  id: number;
  combinedRev: number;
  imageUrl: string;
  gamevalName: string | null | undefined;
  onOpen: (id: number) => void;
};

/** Grid cell for combined sprite index — props are primitives / stable URLs for `React.memo`. */
export const CombinedSpriteGridTile = React.memo(function CombinedSpriteGridTile({
  id,
  combinedRev,
  imageUrl,
  gamevalName,
  onOpen,
}: CombinedSpriteGridTileProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="relative flex min-h-[5.5rem] w-full cursor-pointer flex-col overflow-hidden rounded border border-border bg-muted/30 p-1 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpen(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(id);
        }
      }}
    >
      <div className="relative min-h-[4rem] w-full flex-1 overflow-hidden rounded-sm">
        <RSSprite
          id={id}
          width={64}
          height={64}
          fitMax
          fillCell
          keepAspectRatio
          rounded={false}
          className="absolute inset-0 size-full min-h-0"
          gameval={gamevalName ?? undefined}
          gamevalRevision={combinedRev}
          imageUrl={imageUrl}
          fullSizeImageUrl={imageUrl}
        />
      </div>
      <span className="relative z-10 mt-0.5 w-full shrink-0 px-1 text-center text-xs leading-tight text-muted-foreground">
        {id}
      </span>
    </div>
  );
});

type CombinedSpriteTableRowProps = {
  id: number;
  combinedRev: number;
  imageUrl: string;
  gamevalName: string | null | undefined;
  showGamevalCol: boolean;
  onOpen: (id: number) => void;
};

export const CombinedSpriteTableRow = React.memo(function CombinedSpriteTableRow({
  id,
  combinedRev,
  imageUrl,
  gamevalName,
  showGamevalCol,
  onOpen,
}: CombinedSpriteTableRowProps) {
  const { settings } = useSettings();
  return (
    <TableRow
      role="button"
      tabIndex={0}
      className={DIFF_ARCHIVE_TABLE_ROW_INTERACTIVE_CLASS}
      onClick={() => onOpen(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(id);
        }
      }}
    >
      <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono")}>{id}</TableCell>
      <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
        <LazyWhenVisible
          className="relative inline-flex h-8 w-8 min-h-8 min-w-8 overflow-hidden rounded border border-border bg-muted/30 p-0"
          fallback={<div className="size-full rounded-[inherit] bg-muted/25" aria-hidden />}
        >
          <RSSprite
            id={id}
            width={32}
            height={32}
            fitMax
            fillCell
            keepAspectRatio
            rounded={false}
            className="absolute inset-0 size-full min-h-0"
            gameval={gamevalName ?? undefined}
            gamevalRevision={combinedRev}
            imageUrl={imageUrl}
            fullSizeImageUrl={imageUrl}
          />
        </LazyWhenVisible>
      </TableCell>
      {showGamevalCol ? (
        <TableCell
          className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "text-muted-foreground")}
          data-col-key="gameval"
          onCopy={(e) => onCopyApplyGamevalUppercaseSetting(e, settings.copyGamevalsToUppercase)}
        >
          {gamevalName ?? "—"}
        </TableCell>
      ) : null}
    </TableRow>
  );
});
