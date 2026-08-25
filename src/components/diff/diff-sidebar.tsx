"use client";

import * as React from "react";
import { IconArchive, IconDatabase, IconFileSettings } from "@tabler/icons-react";

import { OptionDropdown } from "@/components/ui/option-dropdown";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSettings } from "@/context/settings-context";
import { cn } from "@/lib/utils";

import { CONFIG_TYPES, DELTA_COUNTS, GAMEVAL_MIN_REVISION } from "./diff-constants";
import type { NavSection } from "@/lib/nav-config";
import type { DeltaBadgeMap } from "@/lib/diff-delta-merge";
import { DiffTypeIcon } from "./diff-type-icon";
import type { DiffMode, Section } from "./diff-types";

const DEFAULT_ARCHIVE_SECTIONS: NavSection[] = [
  { id: "sprites", label: "Sprites" },
  { id: "textures", label: "Textures" },
  { id: "gamevals", label: "Gamevals", minRevision: GAMEVAL_MIN_REVISION },
];

const SIDEBAR_REVISION_DROPDOWN_BTN_CLASS = "!h-8 py-1 text-xs";

const SIDEBAR_NAV_ROW_CLASS =
  "mt-0.5 flex w-full items-center justify-between gap-1.5 rounded-md px-2 py-1.5 pl-4 text-left text-sm";

function DiffNavDeltaBadges({ counts }: { counts: { added: number; changed: number; removed: number } }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {counts.added > 0 ? (
        <span className="rounded bg-green-600/90 px-1 text-[10px] font-medium text-white">+{counts.added}</span>
      ) : null}
      {counts.removed > 0 ? (
        <span className="rounded bg-red-600/90 px-1 text-[10px] font-medium text-white">−{counts.removed}</span>
      ) : null}
      {counts.changed > 0 ? (
        <span className="rounded bg-amber-600 px-1 text-[10px] font-medium text-amber-950">~{counts.changed}</span>
      ) : null}
    </span>
  );
}

function sentenceCaseNavLabel(raw: string): string {
  if (!raw) return raw;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

type DiffSidebarProps = {
  diffViewMode: DiffMode;
  viewRev: "latest" | number;
  setViewRev: (v: "latest" | number) => void;
  baseRev: number;
  setBaseRev: (v: number) => void;
  rev: number;
  setRev: (v: number) => void;
  latestRevision: number;
  /** Newest-first; same option list as Full mode (Latest + each revision). */
  revisionsDesc: number[];
  revisionsLoading?: boolean;
  revisionsError?: string | null;
  /** Archives → Gamevals is only available at/above `GAMEVAL_MIN_REVISION` for the active rev. */
  archivesGamevalEnabled?: boolean;
  section: Section;
  setSection: (s: Section) => void;
  /** Live counts from cache server in Diff mode; `null` uses {@link DELTA_COUNTS} placeholders. */
  deltaBadges?: DeltaBadgeMap | null;
  /** Dynamic nav sections from server; falls back to static CONFIG_TYPES / archive list when null. */
  navSections?: { archives: NavSection[]; configs: NavSection[] } | null;
  /** Per-revision support flags computed from decoded bin content. */
  sectionSupport?: { archives: Record<string, boolean>; configs: Record<string, boolean> } | null;
  /** When true, revision dropdowns are omitted (moved to page chrome). */
  hideRevisionControls?: boolean;
};

export function DiffSidebar({
  diffViewMode,
  viewRev,
  setViewRev,
  baseRev,
  setBaseRev,
  rev,
  setRev,
  latestRevision,
  revisionsDesc,
  revisionsLoading = false,
  revisionsError = null,
  archivesGamevalEnabled = true,
  section,
  setSection,
  deltaBadges = null,
  navSections = null,
  sectionSupport = null,
  hideRevisionControls = false,
}: DiffSidebarProps) {
  const { settings } = useSettings();

  function deltaFor(key: string): { added: number; changed: number; removed: number } {
    const live = deltaBadges?.[key];
    if (live) return live;
    return DELTA_COUNTS[key] ?? { added: 0, changed: 0, removed: 0 };
  }

  const archiveSections = navSections?.archives ?? DEFAULT_ARCHIVE_SECTIONS;
  const configSections: NavSection[] =
    navSections?.configs ?? CONFIG_TYPES.map((id) => ({ id, label: sentenceCaseNavLabel(id), apiType: id }));
  const visibleConfigSections =
    settings.hideNonTransmittedConfigs && sectionSupport
      ? configSections.filter(({ id }) => sectionSupport.configs[id] !== false)
      : configSections;

  const revisionDropdownOptions = React.useMemo(
    () => [
      { value: "latest", label: `Latest (${latestRevision})` },
      ...revisionsDesc
        .filter((r) => r !== latestRevision)
        .map((r) => ({ value: String(r), label: String(r) })),
    ],
    [latestRevision, revisionsDesc],
  );

  return (
    <nav className="flex w-52 flex-shrink-0 flex-col gap-2 overflow-y-auto rounded-lg border bg-muted/30 p-2">
      {!hideRevisionControls ? (
        <header className="shrink-0">
          {revisionsLoading ? (
            diffViewMode === "combined" ? (
              <div aria-busy="true" aria-label="Loading revisions">
                <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  Cache
                  <Skeleton className="h-8 w-full" delayMs={0} />
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5" aria-busy="true" aria-label="Loading revisions">
                <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  Base
                  <Skeleton className="h-8 w-full" delayMs={40} />
                </label>
                <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  Compare
                  <Skeleton className="h-8 w-full" delayMs={120} />
                </label>
              </div>
            )
          ) : diffViewMode === "combined" ? (
            <div>
              {revisionsError ? (
                <p className="mb-1.5 text-[11px] leading-snug text-destructive">{revisionsError}</p>
              ) : null}
              <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                Cache
                <OptionDropdown
                  ariaLabel="Cache revision"
                  value={viewRev === "latest" || viewRev === latestRevision ? "latest" : String(viewRev)}
                  options={[
                    { value: "latest", label: `Latest (${latestRevision})` },
                    ...revisionsDesc
                      .filter((r) => r !== latestRevision)
                      .map((r) => ({ value: String(r), label: String(r) })),
                  ]}
                  onChange={(v) => setViewRev(v === "latest" ? "latest" : Number(v))}
                  buttonClassName={SIDEBAR_REVISION_DROPDOWN_BTN_CLASS}
                />
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {revisionsError ? (
                <p className="text-[11px] leading-snug text-destructive">{revisionsError}</p>
              ) : null}
              <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                Base
                <OptionDropdown
                  ariaLabel="Base revision"
                  value={baseRev === latestRevision ? "latest" : String(baseRev)}
                  options={revisionDropdownOptions}
                  onChange={(v) => setBaseRev(v === "latest" ? latestRevision : Number(v))}
                  buttonClassName={SIDEBAR_REVISION_DROPDOWN_BTN_CLASS}
                />
              </label>
              <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                Compare
                <OptionDropdown
                  ariaLabel="Compare revision"
                  value={rev === latestRevision ? "latest" : String(rev)}
                  options={revisionDropdownOptions}
                  onChange={(v) => setRev(v === "latest" ? latestRevision : Number(v))}
                  buttonClassName={SIDEBAR_REVISION_DROPDOWN_BTN_CLASS}
                />
              </label>
            </div>
          )}
        </header>
      ) : null}

      <div className={cn(!hideRevisionControls && "border-t pt-2")}>
        <div className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-muted-foreground">
          <IconArchive size={16} />
          Archives
        </div>
        {archiveSections.map(({ id, label, minRevision }) => {
          const active = id === section;
          const counts = deltaFor(id);
          const isGamevalsArchive = id === "gamevals";
          const unsupportedByRevision = sectionSupport?.archives[id] === false;
          const gamevalsDisabled =
            isGamevalsArchive && (!archivesGamevalEnabled || diffViewMode === "diff");
          const archiveDisabled = gamevalsDisabled || unsupportedByRevision;

          const archiveButton = (
            <button
              type="button"
              disabled={archiveDisabled}
              className={cn(
                SIDEBAR_NAV_ROW_CLASS,
                active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                archiveDisabled && "cursor-not-allowed opacity-45 hover:bg-transparent",
              )}
              onClick={() => setSection(id as Section)}
            >
              <span className="flex min-w-0 items-center gap-2">
                {isGamevalsArchive ? <IconDatabase size={16} /> : <DiffTypeIcon type={id as Section} />}
                <span className="truncate">{label}</span>
              </span>
              {diffViewMode === "diff" && counts && !isGamevalsArchive && !unsupportedByRevision ? (
                <Tooltip>
                  <TooltipTrigger>
                    <DiffNavDeltaBadges counts={counts} />
                  </TooltipTrigger>
                  <TooltipContent
                    opaque
                    side="right"
                    className="!bg-zinc-950 !text-xs !text-white border border-zinc-800 p-3"
                  >
                    +{counts.added} added, ~{counts.changed} changed, −{counts.removed} removed
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </button>
          );

          if (archiveDisabled) {
            return (
              <Tooltip key={id}>
                <TooltipTrigger render={<span className="mt-0.5 block w-full">{archiveButton}</span>} />
                <TooltipContent opaque side="right" className="text-xs">
                  {unsupportedByRevision
                    ? "Not supported for the selected revision."
                    : diffViewMode === "diff"
                      ? "Gamevals are only available in Full mode."
                      : `Gamevals need revision ${minRevision ?? GAMEVAL_MIN_REVISION}+ for this view (Full: selected rev; Diff: Compare).`}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <React.Fragment key={id}>{archiveButton}</React.Fragment>;
        })}
      </div>

      <div className="pt-2">
        <div className="flex items-center gap-2 px-3 py-1 text-xs font-medium text-muted-foreground">
          <IconFileSettings size={16} />
          Configs
        </div>
        {visibleConfigSections.map(({ id, label }) => {
          const counts = deltaFor(id);
          const unsupportedByRevision = sectionSupport?.configs[id] === false;
          const configButton = (
            <button
              key={id}
              type="button"
              disabled={unsupportedByRevision}
              className={cn(
                SIDEBAR_NAV_ROW_CLASS,
                section === id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                unsupportedByRevision && "cursor-not-allowed opacity-45 hover:bg-transparent",
              )}
              onClick={() => setSection(id as Section)}
              title={unsupportedByRevision ? "Not supported for the selected revision." : undefined}
            >
              <span className="flex min-w-0 items-center gap-2">
                <DiffTypeIcon type={id as Section} />
                <span className="truncate">{label}</span>
              </span>
              {diffViewMode === "diff" && counts && !unsupportedByRevision ? (
                <DiffNavDeltaBadges counts={counts} />
              ) : null}
            </button>
          );

          if (unsupportedByRevision) {
            return (
              <Tooltip key={id}>
                <TooltipTrigger render={<span className="mt-0.5 block w-full">{configButton}</span>} />
                <TooltipContent opaque side="right" className="text-xs">
                  Not supported for the selected revision.
                </TooltipContent>
              </Tooltip>
            );
          }

          return configButton;
        })}
      </div>
    </nav>
  );
}
