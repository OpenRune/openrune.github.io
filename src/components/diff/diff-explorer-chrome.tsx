"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { OptionDropdown } from "@/components/ui/option-dropdown";
import { Skeleton } from "@/components/ui/skeleton";
import { diffSidebarDiffHref, diffSidebarFullHref } from "@/components/diff/diff-constants";
import type { DiffMode, Section } from "@/components/diff/diff-types";
import type { DiffTextLayout } from "@/components/diff/diff-text-layout";
import { cn } from "@/lib/utils";

const DROPDOWN_BTN_CLASS = "!h-8 min-w-[7.5rem] py-1 text-xs";

type DiffExplorerChromeProps = {
  mode: DiffMode;
  section: Section;
  /** Full mode pinned rev. */
  viewRev?: "latest" | number;
  baseRev: number;
  setBaseRev?: (v: number) => void;
  rev: number;
  setRev?: (v: number) => void;
  /** Full mode only. */
  setViewRev?: (v: "latest" | number) => void;
  latestRevision: number;
  revisionsDesc: number[];
  revisionsLoading?: boolean;
  revisionsError?: string | null;
  /**
   * When set, Full/Diff toggles stay on the Diff explorer (advanced shell)
   * instead of navigating to `/diff/full`.
   */
  onModeChange?: (mode: DiffMode) => void;
  diffLayout?: DiffTextLayout;
  onDiffLayoutChange?: (layout: DiffTextLayout) => void;
  /**
   * `full` — Configs page: Unified/Split only (Cache revision lives in the left nav).
   * `diff` — Diff explorer: Full/Diff, layout, Base/Compare.
   */
  variant?: "full" | "diff";
};

export function DiffExplorerChrome({
  mode,
  section,
  viewRev = "latest",
  baseRev,
  setBaseRev,
  rev,
  setRev,
  setViewRev,
  latestRevision,
  revisionsDesc,
  revisionsLoading = false,
  revisionsError = null,
  onModeChange,
  diffLayout = "split",
  onDiffLayoutChange,
  variant = "diff",
}: DiffExplorerChromeProps) {
  const isFullChrome = variant === "full";
  const searchParams = useSearchParams();
  /** Configs page: Unified/Split only apply to text dumps (not table mode). */
  const showLayoutToggle = !isFullChrome || searchParams.get("view") !== "table";

  const revisionDropdownOptions = React.useMemo(
    () => [
      { value: "latest", label: `Latest (${latestRevision})` },
      ...revisionsDesc
        .filter((r) => r !== latestRevision)
        .map((r) => ({ value: String(r), label: String(r) })),
    ],
    [latestRevision, revisionsDesc],
  );

  const fullHref = diffSidebarFullHref(mode, viewRev, rev, latestRevision, section);
  const compareForDiff =
    mode === "combined"
      ? viewRev === "latest" || viewRev === latestRevision
        ? latestRevision
        : viewRev
      : rev;
  const baseForDiff =
    mode === "diff" ? baseRev : baseRev === compareForDiff ? Math.max(1, compareForDiff - 1) : baseRev;
  const diffHref = diffSidebarDiffHref(baseForDiff, compareForDiff, latestRevision, section);

  const modeButtonClass = (active: boolean) =>
    cn(
      "inline-flex h-6 items-center rounded-md px-2 text-[11px] font-medium transition-colors",
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  const layoutEnabled = Boolean(onDiffLayoutChange) && (isFullChrome || mode === "diff");

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {!isFullChrome ? (
        <div
          className="inline-flex h-7 items-center rounded-lg border border-border bg-muted/40 p-0.5"
          role="group"
          aria-label="View mode"
        >
          {onModeChange ? (
            <>
              <button
                type="button"
                className={modeButtonClass(mode === "combined")}
                aria-pressed={mode === "combined"}
                onClick={() => onModeChange("combined")}
              >
                Full
              </button>
              <button
                type="button"
                className={modeButtonClass(mode === "diff")}
                aria-pressed={mode === "diff"}
                onClick={() => onModeChange("diff")}
              >
                Diff
              </button>
            </>
          ) : (
            <>
              <Link
                href={fullHref}
                className={modeButtonClass(mode === "combined")}
                aria-current={mode === "combined" ? "page" : undefined}
              >
                Full
              </Link>
              <Link
                href={diffHref}
                className={modeButtonClass(mode === "diff")}
                aria-current={mode === "diff" ? "page" : undefined}
              >
                Diff
              </Link>
            </>
          )}
        </div>
      ) : null}

      {showLayoutToggle ? (
        <div
          className={cn(
            "inline-flex h-7 items-center rounded-lg border border-border bg-muted/40 p-0.5",
            !layoutEnabled && "opacity-45",
          )}
          role="group"
          aria-label="Diff layout"
          aria-disabled={!layoutEnabled}
        >
          <button
            type="button"
            className={modeButtonClass(diffLayout === "unified")}
            aria-pressed={diffLayout === "unified"}
            disabled={!layoutEnabled}
            onClick={() => onDiffLayoutChange?.("unified")}
          >
            Unified
          </button>
          <button
            type="button"
            className={modeButtonClass(diffLayout === "split")}
            aria-pressed={diffLayout === "split"}
            disabled={!layoutEnabled}
            onClick={() => onDiffLayoutChange?.("split")}
          >
            Split
          </button>
        </div>
      ) : null}

      {!isFullChrome ? (
        revisionsLoading ? (
          <div className="flex items-center gap-2" aria-busy="true" aria-label="Loading revisions">
            <Skeleton className="h-8 w-[7.5rem]" />
            <Skeleton className="h-8 w-[7.5rem]" delayMs={60} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {revisionsError ? (
              <p className="max-w-[12rem] truncate text-[11px] text-destructive" title={revisionsError}>
                {revisionsError}
              </p>
            ) : null}

            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="shrink-0">Base</span>
              <OptionDropdown
                ariaLabel="Base revision"
                value={
                  mode === "combined"
                    ? viewRev === "latest" || viewRev === latestRevision
                      ? "latest"
                      : String(viewRev)
                    : baseRev === latestRevision
                      ? "latest"
                      : String(baseRev)
                }
                options={revisionDropdownOptions}
                onChange={(v) => {
                  const next = v === "latest" ? latestRevision : Number(v);
                  if (mode === "combined") {
                    setViewRev?.(v === "latest" ? "latest" : next);
                  } else {
                    setBaseRev?.(next);
                  }
                }}
                buttonClassName={DROPDOWN_BTN_CLASS}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="shrink-0">Compare</span>
              <OptionDropdown
                ariaLabel="Compare revision"
                value={rev === latestRevision ? "latest" : String(rev)}
                options={revisionDropdownOptions}
                disabled={mode === "combined"}
                onChange={(v) => setRev?.(v === "latest" ? latestRevision : Number(v))}
                buttonClassName={DROPDOWN_BTN_CLASS}
              />
            </label>
          </div>
        )
      ) : null}
    </div>
  );
}
