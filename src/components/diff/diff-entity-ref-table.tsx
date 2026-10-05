"use client";

import * as React from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { ModalPagination } from "./diff-modal-pagination";
import { useModalPaging } from "./diff-modal-paging";
import {
  OpenRuneItemImage,
  OpenRuneNpcImage,
  OpenRuneObjectImage,
} from "./diff-openrune-archive-table-cell";

export type EntityRef = { id: number; name: string | null };

/** Thumbnail for a referenced definition; models and overlays have no rendered image. */
export function EntityThumb({ kind, id }: { kind: string; id: number }) {
  if (kind === "items") {
    return (
      <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30 p-0.5">
        <OpenRuneItemImage id={id} />
      </div>
    );
  }
  if (kind === "npcs" || kind === "objects") {
    return (
      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/30 p-1">
        {kind === "npcs" ? <OpenRuneNpcImage id={id} /> : <OpenRuneObjectImage id={id} />}
      </div>
    );
  }
  return (
    <div
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-muted/30 text-[10px] text-muted-foreground"
      aria-hidden
    >
      —
    </div>
  );
}

export type EntityRefTableProps = {
  /** `items` / `npcs` / `objects` / `models` / `overlay` — drives the thumbnail. */
  kind: string;
  entries: EntityRef[];
  /** Omit to render inert rows. */
  onSelect?: (entry: EntityRef) => void;
};

/** Image / ID / Gameval table with paging, shared by the model and texture dialogs. */
export function EntityRefTable({ kind, entries, onSelect }: EntityRefTableProps) {
  const paging = useModalPaging(entries, kind);
  const clickable = Boolean(onSelect);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 w-16 text-xs">Image</TableHead>
            <TableHead className="h-8 w-20 text-xs">ID</TableHead>
            <TableHead className="h-8 text-xs">Gameval</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paging.items.map((entry) => (
            <TableRow
              key={`${kind}-${entry.id}`}
              className={cn(clickable && "cursor-pointer hover:bg-muted/40")}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              title={clickable ? `Open ${entry.name ?? entry.id}` : undefined}
              onClick={() => onSelect?.(entry)}
              onKeyDown={(e) => {
                if (!clickable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(entry);
                }
              }}
            >
              <TableCell className="py-1.5">
                <EntityThumb kind={kind} id={entry.id} />
              </TableCell>
              <TableCell className="py-1.5 font-mono text-xs tabular-nums">{entry.id}</TableCell>
              <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">
                {entry.name ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {paging.paged ? (
        <ModalPagination
          page={paging.page}
          totalPages={paging.totalPages}
          totalCount={entries.length}
          onPageChange={paging.setPage}
        />
      ) : null}
    </>
  );
}
