"use client";

import * as React from "react";
import { Boxes, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePaginationBar } from "@/components/ui/table-pagination-bar";
import { useCacheType } from "@/context/cache-type-context";
import { diffCacheOrderedPair, modelsDeltaUrl, modelsTableUrl } from "@/lib/cache-api-client";
import { cn } from "@/lib/utils";

import { DiffArchiveTable } from "./diff-archive-table";
import { DiffModelDetailModal } from "./diff-model-detail-modal";
import { sanitizeSpriteIdSearchInput } from "./diff-id-search";
import { DIFF_COMBINED_SEARCH_WRAP_CLASS } from "./diff-constants";
import {
  DIFF_ARCHIVE_TABLE_CELL_CLASS,
  DIFF_ARCHIVE_TABLE_HEAD_CLASS,
  DIFF_ARCHIVE_TABLE_HEADER_CLASS,
  DIFF_ARCHIVE_TABLE_ROW_CLASS,
} from "./diff-table-archive-styles";
import type { DiffMode, DiffSearchFieldMode } from "./diff-types";
import { DiffUnifiedSearchField } from "./diff-unified-search-field";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const PAGE_SIZES = [25, 50, 100, 250] as const;

/** Models have no gameval or name to match on — ID is the only usable mode. */
const MODEL_SEARCH_DISABLED_MODES: readonly DiffSearchFieldMode[] = ["gameval", "name", "regex"];
const MODEL_SEARCH_MODE_TITLES: Partial<Record<DiffSearchFieldMode, string>> = {
  gameval: "Models: use ID only.",
  name: "Models: use ID only.",
  regex: "Models: use ID only.",
};

type ModelRow = {
  id: number;
  vertexCount: number;
  faceCount: number;
  transparentFaceCount: number;
  hasTransparency: boolean;
};

type ModelDelta = {
  added: number[];
  removed: number[];
  changed: number[];
};

function num(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function numList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

/** Marks a `404` so callers can show an empty state instead of a failure. */
class NoModelDataError extends Error {}

async function readJsonOrThrow(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  if (res.status === 404) throw new NoModelDataError("no data");
  throw new Error(`HTTP ${res.status}`);
}

export type DiffModelsViewProps = {
  diffViewMode: DiffMode;
  combinedRev: number;
  baseRev: number;
  rev: number;
  /** Lets the detail modal jump to an item / npc / object that uses the model. */
  onNavigateSection?: (section: string) => void;
};

export function DiffModelsView({
  diffViewMode,
  combinedRev,
  baseRev,
  rev,
  onNavigateSection,
}: DiffModelsViewProps) {
  const { selectedCacheType } = useCacheType();
  const [pageSize, setPageSize] = React.useState<number>(50);
  const [page, setPage] = React.useState(1);
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [rows, setRows] = React.useState<ModelRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [delta, setDelta] = React.useState<ModelDelta | null>(null);
  /** `empty` = server has no model metadata for the revision yet, which is not a failure. */
  const [status, setStatus] = React.useState<"idle" | "loading" | "ok" | "empty" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [detailId, setDetailId] = React.useState<number | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [combinedRev, debouncedQuery, pageSize]);

  React.useEffect(() => {
    setDetailId(null);
  }, [combinedRev, diffViewMode]);

  // Combined mode: paginated table straight off the merged model set.
  React.useEffect(() => {
    if (diffViewMode !== "combined") return;
    let cancelled = false;
    setStatus("loading");
    setError(null);
    const url = modelsTableUrl(selectedCacheType, {
      rev: combinedRev,
      offset: (page - 1) * pageSize,
      limit: pageSize,
      q: debouncedQuery,
    });
    fetch(url)
      .then(readJsonOrThrow)
      .then((data: unknown) => {
        if (cancelled) return;
        const o = (data ?? {}) as Record<string, unknown>;
        const raw = Array.isArray(o.rows) ? o.rows : [];
        setRows(
          raw.map((entry) => {
            const r = (entry ?? {}) as Record<string, unknown>;
            return {
              id: num(r.id),
              vertexCount: num(r.vertexCount),
              faceCount: num(r.faceCount),
              transparentFaceCount: num(r.transparentFaceCount),
              hasTransparency: Boolean(r.hasTransparency),
            };
          }),
        );
        setTotal(num(o.total));
        setStatus("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        if (e instanceof NoModelDataError) {
          setStatus("empty");
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to load models");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [combinedRev, debouncedQuery, diffViewMode, page, pageSize, selectedCacheType]);

  // Diff mode: ids only for now.
  React.useEffect(() => {
    if (diffViewMode !== "diff") return;
    let cancelled = false;
    setStatus("loading");
    setError(null);
    const pair = diffCacheOrderedPair(baseRev, rev);
    fetch(modelsDeltaUrl(selectedCacheType, pair.base, pair.rev))
      .then(readJsonOrThrow)
      .then((data: unknown) => {
        if (cancelled) return;
        const o = (data ?? {}) as Record<string, unknown>;
        setDelta({
          added: numList(o.added),
          removed: numList(o.removed),
          changed: numList(o.changed),
        });
        setStatus("ok");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setDelta(null);
        if (e instanceof NoModelDataError) {
          setStatus("empty");
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to load model delta");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [baseRev, diffViewMode, rev, selectedCacheType]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (diffViewMode === "diff") {
    const groups = delta
      ? [
          { key: "added", label: "Added", ids: delta.added, tone: "text-green-500" },
          { key: "changed", label: "Changed", ids: delta.changed, tone: "text-amber-500" },
          { key: "removed", label: "Removed", ids: delta.removed, tone: "text-red-500" },
        ].filter((g) => g.ids.length > 0)
      : [];
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {status === "loading" ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading model delta…
          </div>
        ) : status === "empty" ? (
          <p className="p-6 text-sm text-muted-foreground">No model data for this revision.</p>
        ) : status === "error" ? (
          <p className="p-6 text-sm text-destructive">
            Failed to load model delta{error ? `: ${error}` : ""}.
          </p>
        ) : groups.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No model changes between these revisions.</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
            {groups.map((group) => (
              <section key={group.key}>
                <h3 className={cn("mb-1.5 text-sm font-semibold", group.tone)}>
                  {group.label} <span className="tabular-nums text-muted-foreground">({group.ids.length})</span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {group.ids.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDetailId(id)}
                      className="inline-flex items-center rounded-none border border-border bg-muted/30 px-2 py-1 font-mono text-xs tabular-nums hover:bg-muted"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <DiffModelDetailModal
          modelId={detailId}
          rev={Math.max(baseRev, rev)}
          open={detailId != null}
          onOpenChange={(open) => {
            if (!open) setDetailId(null);
          }}
          onNavigateSection={onNavigateSection}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={DIFF_COMBINED_SEARCH_WRAP_CLASS}>
        <DiffUnifiedSearchField
          mode="id"
          // Models carry no gamevals or names, so ID is the only meaningful mode.
          onModeChange={() => {}}
          disabledModes={MODEL_SEARCH_DISABLED_MODES}
          modeOptionTitles={MODEL_SEARCH_MODE_TITLES}
          tagModes={[]}
          value={query}
          onChange={(e) => setQuery(sanitizeSpriteIdSearchInput(e.target.value))}
          placeholders={{ id: "Search by model id…" }}
          searchAriaLabel="Search models"
        />
      </div>

      {status === "empty" ? (
        <p className="p-6 text-sm text-muted-foreground">No model data for this revision.</p>
      ) : status === "error" ? (
        <p className="p-6 text-sm text-destructive">Failed to load models{error ? `: ${error}` : ""}.</p>
      ) : (
        <>
          <DiffArchiveTable>
            <TableHeader className={DIFF_ARCHIVE_TABLE_HEADER_CLASS}>
              <TableRow>
                <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>ID</TableHead>
                <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Vertices</TableHead>
                <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Triangles</TableHead>
                <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>Transparency</TableHead>
                <TableHead className={DIFF_ARCHIVE_TABLE_HEAD_CLASS}>More</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className={DIFF_ARCHIVE_TABLE_ROW_CLASS}>
                  <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono")}>{row.id}</TableCell>
                  <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono tabular-nums")}>
                    {row.vertexCount.toLocaleString()}
                  </TableCell>
                  <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "font-mono tabular-nums")}>
                    {row.faceCount.toLocaleString()}
                  </TableCell>
                  <TableCell className={cn(DIFF_ARCHIVE_TABLE_CELL_CLASS, "text-xs")}>
                    {row.hasTransparency ? `yes (${row.transparentFaceCount})` : "no"}
                  </TableCell>
                  <TableCell className={DIFF_ARCHIVE_TABLE_CELL_CLASS}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 rounded-none px-2 text-xs"
                      title={`View model ${row.id}`}
                      onClick={() => setDetailId(row.id)}
                    >
                      <Boxes className="size-3.5" aria-hidden />
                      More
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {status === "ok" && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                    No models for this revision (or no matches).
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </DiffArchiveTable>

          <TablePaginationBar
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZES}
            onPageSizeChange={setPageSize}
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            showingCount={rows.length}
            totalCount={total}
            countLabel="models"
          />
        </>
      )}

      <DiffModelDetailModal
        modelId={detailId}
        rev={combinedRev}
        open={detailId != null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        onNavigateSection={onNavigateSection}
      />
    </div>
  );
}
