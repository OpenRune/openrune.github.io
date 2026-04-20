"use client";

import * as React from "react";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DiffConfigView } from "@/components/diff/diff-config-view";
import {
  applyNavConfigSections,
  DELTA_COUNTS,
  DIFF_DEFAULT_SECTION,
  DIFF_ROUTE_DIFFVIEW,
  DIFF_URL_PARAM_BASE,
  DIFF_URL_PARAM_COMPARE,
  DIFF_URL_PARAM_FROM,
  DIFF_URL_PARAM_REV,
  DIFF_URL_PARAM_SECTION,
  DIFF_URL_PARAM_TO,
  defaultDiffRevisionPair,
  diffSidebarDiffHref,
  diffSidebarFullHref,
  diffWorkbenchSearchString,
  GAMEVAL_FULL_TAB_ORDER,
  GAMEVAL_MIN_REVISION,
  GAMEVAL_VARCS_MIN_REVISION,
  resolveDiffSectionFromUrl,
  REVISIONS_FALLBACK,
} from "@/components/diff/diff-constants";
import { DiffSidebar } from "@/components/diff/diff-sidebar";
import type { DiffMode, Section } from "@/components/diff/diff-types";
import { isArchiveEntitySection } from "@/components/diff/diff-openrune-archive-columns";
import type { GamevalType } from "@/context/gameval-context";
import { useCacheType } from "@/context/cache-type-context";
import {
  cacheProxyHeaders,
  diffCacheOrderedPair,
  diffDeltaSpritesSummaryUrl,
  diffDeltaSummaryUrl,
  diffRevisionsUrl,
  diffSupportManifestUrl,
  parseDiffRevisionsResponse,
} from "@/lib/cache-proxy-client";
import { mergeDeltaBadgeMaps, type DeltaBadgeMap } from "@/lib/diff-delta-merge";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";
import { cacheGamevalGroupsUrl, cacheNavUrl, parseGamevalGroups, parseNavConfig, type GamevalGroup, type NavConfig } from "@/lib/nav-config";

const DiffMainViewSkeleton = () => (
  <div
    className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6"
    aria-busy="true"
    aria-label="Loading section"
  >
    <Skeleton className="h-9 w-full max-w-lg" />
    <Skeleton className="min-h-[12rem] w-full max-w-4xl flex-1" />
  </div>
);

const DiffSpritesView = dynamic(
  () => import("@/components/diff/diff-sprites-view").then((m) => ({ default: m.DiffSpritesView })),
  { loading: () => <DiffMainViewSkeleton /> },
);
const DiffTexturesView = dynamic(
  () => import("@/components/diff/diff-textures-view").then((m) => ({ default: m.DiffTexturesView })),
  { loading: () => <DiffMainViewSkeleton /> },
);
const DiffGamevalsFullView = dynamic(
  () => import("@/components/diff/diff-gamevals-full-view").then((m) => ({ default: m.DiffGamevalsFullView })),
  { loading: () => <DiffMainViewSkeleton /> },
);
const DiffInventoryView = dynamic(
  () => import("@/components/diff/diff-inventory-view").then((m) => ({ default: m.DiffInventoryView })),
  { loading: () => <DiffMainViewSkeleton /> },
);
const DiffConfigArchiveEntityView = dynamic(
  () =>
    import("@/components/diff/diff-config-archive-entity-view").then((m) => ({
      default: m.DiffConfigArchiveEntityView,
    })),
  { loading: () => <DiffMainViewSkeleton /> },
);

function normalizeQueryString(qs: string): string {
  const u = new URLSearchParams(qs);
  return [...u.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}

function DiffLayoutFallback() {
  return (
    <Card className="mx-auto flex h-[calc(100vh-3rem)] max-w-[98%] flex-col overflow-hidden p-4">
      <CardHeader className="shrink-0 px-0 pt-0 pb-3">
        <CardTitle>Configs / Diff</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-grow flex-col items-center justify-center overflow-hidden p-6 text-sm text-muted-foreground">
        Loading…
      </CardContent>
    </Card>
  );
}

type SectionSupportManifest = {
  rev: number;
  archives: Record<string, boolean>;
  configs: Record<string, boolean>;
};

function parseSectionSupportManifest(data: unknown): SectionSupportManifest | null {
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  if (typeof raw.rev !== "number") return null;
  if (!raw.archives || typeof raw.archives !== "object") return null;
  if (!raw.configs || typeof raw.configs !== "object") return null;

  const parseBoolMap = (value: unknown): Record<string, boolean> => {
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
        typeof v === "boolean" ? [[k, v]] : [],
      ),
    );
  };

  return {
    rev: raw.rev,
    archives: parseBoolMap(raw.archives),
    configs: parseBoolMap(raw.configs),
  };
}

function DiffLayoutWithSearchParams({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const diffViewMode: DiffMode = pathname.startsWith(DIFF_ROUTE_DIFFVIEW) ? "diff" : "combined";

  const { selectedCacheType } = useCacheType();
  const revisionsFetchSeq = React.useRef(0);
  const deltaFetchSeq = React.useRef(0);

  const [deltaBadges, setDeltaBadges] = React.useState<DeltaBadgeMap | null>(null);
  const [navConfig, setNavConfig] = React.useState<NavConfig | null>(null);
  const [gamevalGroups, setGamevalGroups] = React.useState<GamevalGroup[]>([]);
  const [sectionSupport, setSectionSupport] = React.useState<SectionSupportManifest | null>(null);

  const [viewRev, setViewRev] = React.useState<"latest" | number>("latest");
  const [baseRev, setBaseRev] = React.useState(REVISIONS_FALLBACK[0]);
  const [rev, setRev] = React.useState(REVISIONS_FALLBACK[REVISIONS_FALLBACK.length - 1]);
  const [section, setSection] = React.useState<Section>(DIFF_DEFAULT_SECTION);
  /** Active gameval dump tab; URL stays `section=gamevals` while switching inner tabs (no `gamevals_*` churn). */
  const [gamevalTab, setGamevalTab] = React.useState<GamevalType>("items");

  const [revisions, setRevisions] = React.useState<number[]>(REVISIONS_FALLBACK);
  const [revisionsLoading, setRevisionsLoading] = React.useState(true);
  const [revisionsError, setRevisionsError] = React.useState<string | null>(null);

  const sortedAsc = React.useMemo(
    () => [...new Set(revisions)].filter((n) => Number.isFinite(n)).sort((a, b) => a - b),
    [revisions],
  );

  const latestRevision =
    sortedAsc.length > 0 ? sortedAsc[sortedAsc.length - 1] : REVISIONS_FALLBACK[REVISIONS_FALLBACK.length - 1];

  const revisionsDesc = React.useMemo(() => [...sortedAsc].sort((a, b) => b - a), [sortedAsc]);

  const combinedRev = viewRev === "latest" ? latestRevision : viewRev;
  const activeRevisionForSupport = diffViewMode === "combined" ? combinedRev : rev;

  const navGamevalsMinRevision = React.useMemo(
    () => navConfig?.archives.find((entry) => entry.id === "gamevals")?.minRevision ?? GAMEVAL_MIN_REVISION,
    [navConfig],
  );

  const archivesGamevalEnabled =
    (diffViewMode === "combined" ? combinedRev >= navGamevalsMinRevision : rev >= navGamevalsMinRevision) &&
    (sectionSupport?.archives.gamevals ?? true);

  const effectiveGamevalRevision = diffViewMode === "combined" ? combinedRev : rev;

  const knownGamevalTabs = React.useMemo<GamevalType[]>(() => {
    const dynamic = [...new Set(gamevalGroups.map((g) => (g.id === "components" ? "interfaces" : g.id)))];
    return dynamic.length > 0 ? dynamic : [...GAMEVAL_FULL_TAB_ORDER];
  }, [gamevalGroups]);

  const minRevisionForGamevalTab = React.useCallback(
    (tab: GamevalType): number => {
      const raw = tab === "interfaces" ? "components" : tab;
      const fromGroups = gamevalGroups.find((g) => g.id === raw)?.minRevision;
      if (typeof fromGroups === "number") return fromGroups;
      if (tab === "varcs") return GAMEVAL_VARCS_MIN_REVISION;
      return GAMEVAL_MIN_REVISION;
    },
    [gamevalGroups],
  );

  const revisionsFingerprint = sortedAsc.join(",");

  const revisionsReady = !revisionsLoading && sortedAsc.length > 0;

  React.useEffect(() => {
    async function loadNav() {
      try {
        const [navRes, groupRes] = await Promise.all([
          fetch(cacheNavUrl(), {
            cache: "no-store",
            headers: cacheProxyHeaders(selectedCacheType),
          }),
          fetch(cacheGamevalGroupsUrl(), {
            cache: "no-store",
            headers: cacheProxyHeaders(selectedCacheType),
          }),
        ]);
        if (navRes.ok) {
          const parsed = parseNavConfig(await navRes.json());
          if (parsed) {
            setNavConfig(parsed);
            applyNavConfigSections(parsed);
          }
        }
        if (groupRes.ok) {
          setGamevalGroups(parseGamevalGroups(await groupRes.json()));
        }
      } catch {
        // sidebar falls back to static config
      }
    }
    void loadNav();
  }, [selectedCacheType]);

  React.useEffect(() => {
    const targetRev = activeRevisionForSupport;
    const key = `diff:support:manifest:${selectedCacheType.id}:${targetRev}`;

    void (async () => {
      try {
        const { data } = await conditionalJsonFetch<unknown>(
          key,
          diffSupportManifestUrl(targetRev),
          { headers: cacheProxyHeaders(selectedCacheType) },
        );
        const parsed = parseSectionSupportManifest(data);
        setSectionSupport(parsed);
      } catch {
        setSectionSupport(null);
      }
    })();
  }, [activeRevisionForSupport, selectedCacheType]);

  const replaceWorkbenchUrl = React.useCallback(
    (
      mode: DiffMode,
      nextView: "latest" | number,
      nextBase: number,
      nextTo: number,
      nextSection: Section,
    ) => {
      const params = new URLSearchParams(
        diffWorkbenchSearchString({
        mode,
        viewRev: nextView,
        baseRev: nextBase,
        rev: nextTo,
        latestRevision,
        section: nextSection,
        }),
      );

      const currentViewParam = searchParams.get("view");
      if (mode === "combined" && currentViewParam === "text") {
        params.set("view", "text");
      } else {
        params.delete("view");
      }

      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      const currentQs = searchParams.toString();
      if (normalizeQueryString(qs) !== normalizeQueryString(currentQs)) {
        router.replace(href, { scroll: false });
      }
    },
    [latestRevision, pathname, router, searchParams],
  );

  const setViewRevAndUrl = React.useCallback(
    (v: "latest" | number) => {
      setViewRev(v);
      if (diffViewMode === "combined") replaceWorkbenchUrl("combined", v, baseRev, rev, section);
    },
    [baseRev, diffViewMode, replaceWorkbenchUrl, rev, section],
  );

  const setBaseRevAndUrl = React.useCallback(
    (b: number) => {
      setBaseRev(b);
      if (diffViewMode === "diff") replaceWorkbenchUrl("diff", viewRev, b, rev, section);
    },
    [diffViewMode, replaceWorkbenchUrl, rev, section, viewRev],
  );

  const setRevAndUrl = React.useCallback(
    (t: number) => {
      setRev(t);
      if (diffViewMode === "diff") replaceWorkbenchUrl("diff", viewRev, baseRev, t, section);
    },
    [baseRev, diffViewMode, replaceWorkbenchUrl, section, viewRev],
  );

  const setSectionAndUrl = React.useCallback(
    (next: Section) => {
      if (next === "gamevals" && section !== "gamevals") {
        setGamevalTab("items");
      }
      setSection(next);
      replaceWorkbenchUrl(diffViewMode, viewRev, baseRev, rev, next);
    },
    [baseRev, diffViewMode, replaceWorkbenchUrl, rev, section, viewRev],
  );

  React.useEffect(() => {
    if (!archivesGamevalEnabled && section === "gamevals") {
      setSection(DIFF_DEFAULT_SECTION);
    }
  }, [archivesGamevalEnabled, section]);

  React.useEffect(() => {
    if (!sectionSupport) return;
    const isArchive = section === "sprites" || section === "textures" || section === "gamevals";
    const supported = isArchive
      ? sectionSupport.archives[section] !== false
      : sectionSupport.configs[section] !== false;
    if (supported) return;

    const configCandidates = navConfig?.configs.map((entry) => entry.id) ?? Object.keys(sectionSupport.configs);
    const archiveCandidates = navConfig?.archives.map((entry) => entry.id) ?? Object.keys(sectionSupport.archives);
    const fallbackConfig = configCandidates.find((id) => sectionSupport.configs[id] !== false);
    const fallbackArchive = archiveCandidates.find((id) => sectionSupport.archives[id] !== false);
    const nextSection = (fallbackConfig ?? fallbackArchive ?? DIFF_DEFAULT_SECTION) as Section;

    if (nextSection !== section) {
      setSectionAndUrl(nextSection);
    }
  }, [navConfig, section, sectionSupport, setSectionAndUrl]);

  /** Gamevals explorer is Full-only (matches legacy diff site). */
  React.useEffect(() => {
    if (diffViewMode !== "diff") return;
    if (section !== "gamevals" && !section.startsWith("gamevals_")) return;
    setSectionAndUrl(DIFF_DEFAULT_SECTION);
  }, [diffViewMode, section, setSectionAndUrl]);

  React.useEffect(() => {
    if (effectiveGamevalRevision >= minRevisionForGamevalTab(gamevalTab)) return;
    const next = knownGamevalTabs.find((t) => effectiveGamevalRevision >= minRevisionForGamevalTab(t)) ?? "items";
    if (next !== gamevalTab) setGamevalTab(next);
  }, [effectiveGamevalRevision, gamevalTab, knownGamevalTabs, minRevisionForGamevalTab]);

  React.useEffect(() => {
    if (knownGamevalTabs.length === 0) return;
    if (knownGamevalTabs.includes(gamevalTab)) return;
    setGamevalTab(knownGamevalTabs[0]!);
  }, [knownGamevalTabs, gamevalTab]);

  React.useEffect(() => {
    if (section !== "gamevals") return;
    const min = minRevisionForGamevalTab(gamevalTab);
    if (effectiveGamevalRevision >= min) return;
    const next = knownGamevalTabs.find((t) => effectiveGamevalRevision >= minRevisionForGamevalTab(t)) ?? "items";
    if (next !== gamevalTab) setGamevalTab(next);
  }, [section, effectiveGamevalRevision, gamevalTab, knownGamevalTabs, minRevisionForGamevalTab]);

  React.useEffect(() => {
    if (knownGamevalTabs.length === 0) return;
    if (knownGamevalTabs.includes("items")) return;
    if (gamevalTab === "items") {
      setGamevalTab(knownGamevalTabs[0]!);
    }
  }, [knownGamevalTabs, gamevalTab]);

  React.useEffect(() => {
    const seq = ++revisionsFetchSeq.current;

    async function load() {
      setRevisionsLoading(true);
      setRevisionsError(null);
      try {
        const response = await fetch(diffRevisionsUrl(), {
          cache: "no-store",
          headers: cacheProxyHeaders(selectedCacheType),
        });
        if (seq !== revisionsFetchSeq.current) return;
        if (!response.ok) {
          let message = `HTTP ${response.status}`;
          try {
            const errJson = (await response.json()) as { message?: string; error?: string };
            message = errJson.message ?? errJson.error ?? message;
          } catch {
            // ignore
          }
          throw new Error(message);
        }
        const parsed = parseDiffRevisionsResponse(await response.json());
        if (seq !== revisionsFetchSeq.current) return;
        if (parsed.length === 0) {
          setRevisions(REVISIONS_FALLBACK);
          setRevisionsError("Revisions list was empty; using offline fallback.");
        } else {
          setRevisions(parsed);
        }
      } catch (e) {
        if (seq !== revisionsFetchSeq.current) return;
        setRevisions(REVISIONS_FALLBACK);
        setRevisionsError(e instanceof Error ? e.message : "Failed to load revisions");
      } finally {
        if (seq === revisionsFetchSeq.current) setRevisionsLoading(false);
      }
    }

    void load();
  }, [selectedCacheType.id]);

  /** Diff defaults: Base = newest in list; Compare = next listed revision below Base. Full: keep viewRev. */
  React.useEffect(() => {
    if (sortedAsc.length === 0) return;
    const { baseRev: defaultBase, compareRev: defaultCompare } = defaultDiffRevisionPair(sortedAsc);
    setBaseRev((b) => (sortedAsc.includes(b) ? b : defaultBase));
    setRev((r) => (sortedAsc.includes(r) ? r : defaultCompare));
    setViewRev((v) => {
      if (v === "latest") return "latest";
      return sortedAsc.includes(v) ? v : "latest";
    });
  }, [revisionsFingerprint]);

  React.useEffect(() => {
    if (diffViewMode !== "diff" || baseRev === rev) {
      setDeltaBadges(null);
      return;
    }

    const seq = ++deltaFetchSeq.current;
    const params = diffCacheOrderedPair(baseRev, rev);
    const cfgKey = `diff:delta:summary:${selectedCacheType.id}:${params.base}:${params.rev}`;
    const sprKey = `diff:delta:spritesummary:${selectedCacheType.id}:${params.base}:${params.rev}`;

    void (async () => {
      try {
        const [cfg, spr] = await Promise.all([
          conditionalJsonFetch<{ configs?: Record<string, { added?: number; changed?: number; removed?: number }> }>(
            cfgKey,
            diffDeltaSummaryUrl(params),
            { headers: cacheProxyHeaders(selectedCacheType) },
          ),
          conditionalJsonFetch<{ added?: number; changed?: number; removed?: number }>(
            sprKey,
            diffDeltaSpritesSummaryUrl(params),
            { headers: cacheProxyHeaders(selectedCacheType) },
          ),
        ]);
        if (seq !== deltaFetchSeq.current) return;
        setDeltaBadges(mergeDeltaBadgeMaps(DELTA_COUNTS as DeltaBadgeMap, cfg.data?.configs, spr.data));
      } catch {
        if (seq !== deltaFetchSeq.current) return;
        setDeltaBadges(null);
      }
    })();
  }, [diffViewMode, baseRev, rev, selectedCacheType.id]);

  React.useEffect(() => {
    if (!revisionsReady) return;

    if (diffViewMode === "combined") {
      const raw = searchParams.get(DIFF_URL_PARAM_REV);
      if (raw == null || raw === "") {
        setViewRev((cur) => (cur === "latest" ? cur : "latest"));
        return;
      }
      const n = Number(raw);
      if (Number.isFinite(n) && sortedAsc.includes(n)) {
        if (n === latestRevision) {
          setViewRev((cur) => (cur === "latest" ? cur : "latest"));
          replaceWorkbenchUrl("combined", "latest", baseRev, rev, section);
        } else {
          setViewRev((cur) => (cur === n ? cur : n));
        }
      } else {
        setViewRev("latest");
        replaceWorkbenchUrl("combined", "latest", baseRev, rev, section);
      }
      return;
    }

    const { baseRev: defaultBase, compareRev: defaultCompare } = defaultDiffRevisionPair(sortedAsc);

    const baseRaw =
      searchParams.get(DIFF_URL_PARAM_BASE) ?? searchParams.get(DIFF_URL_PARAM_FROM);
    const compareRaw =
      searchParams.get(DIFF_URL_PARAM_COMPARE) ?? searchParams.get(DIFF_URL_PARAM_TO);
    const f = baseRaw != null && baseRaw !== "" ? Number(baseRaw) : NaN;
    const t = compareRaw != null && compareRaw !== "" ? Number(compareRaw) : NaN;
    const hasValidBase = Number.isFinite(f) && sortedAsc.includes(f);
    const hasValidCompare = Number.isFinite(t) && sortedAsc.includes(t);

    const nextBase = hasValidBase ? f : defaultBase;
    const nextTo = hasValidCompare ? t : defaultCompare;

    setBaseRev((cur) => (cur === nextBase ? cur : nextBase));
    setRev((cur) => (cur === nextTo ? cur : nextTo));

    if (!hasValidBase || !hasValidCompare) {
      const rawSection = searchParams.get(DIFF_URL_PARAM_SECTION);
      const resolvedSection =
        rawSection != null && rawSection !== ""
          ? resolveDiffSectionFromUrl(rawSection, archivesGamevalEnabled, nextTo)
          : section;
      const rewrittenSection =
        rawSection != null &&
        rawSection !== "" &&
        resolvedSection === DIFF_DEFAULT_SECTION &&
        rawSection !== DIFF_DEFAULT_SECTION &&
        isArchiveEntitySection(rawSection)
          ? rawSection
          : resolvedSection;
      replaceWorkbenchUrl("diff", viewRev, nextBase, nextTo, rewrittenSection);
    }
  }, [
    revisionsReady,
    sortedAsc,
    diffViewMode,
    searchParams,
    latestRevision,
    baseRev,
    rev,
    replaceWorkbenchUrl,
    viewRev,
    section,
    archivesGamevalEnabled,
  ]);

  React.useEffect(() => {
    const raw = searchParams.get(DIFF_URL_PARAM_SECTION);
    if (raw == null || raw === "") return;
    const canRewriteSectionUrl = revisionsReady;

    if (raw.startsWith("gamevals_") && archivesGamevalEnabled) {
      const suffix = raw.slice("gamevals_".length) as GamevalType;
      if (knownGamevalTabs.includes(suffix)) {
        if (raw !== "gamevals") {
          setGamevalTab(suffix);
        }
        setSection((cur) => (cur === "gamevals" ? cur : "gamevals"));
        if (canRewriteSectionUrl && raw !== "gamevals") {
          replaceWorkbenchUrl(diffViewMode, viewRev, baseRev, rev, "gamevals");
        }
        return;
      }
    }

    const resolved = resolveDiffSectionFromUrl(raw, archivesGamevalEnabled, effectiveGamevalRevision);
    const preserveRawArchiveSection =
      resolved === DIFF_DEFAULT_SECTION &&
      raw !== DIFF_DEFAULT_SECTION &&
      isArchiveEntitySection(raw);
    const nextSection = preserveRawArchiveSection ? (raw as Section) : resolved;
    setSection((cur) => (cur === nextSection ? cur : nextSection));

    if (canRewriteSectionUrl && !preserveRawArchiveSection && raw !== resolved) {
      replaceWorkbenchUrl(diffViewMode, viewRev, baseRev, rev, resolved);
    }
  }, [
    archivesGamevalEnabled,
    baseRev,
    diffViewMode,
    effectiveGamevalRevision,
    knownGamevalTabs,
    replaceWorkbenchUrl,
    revisionsReady,
    rev,
    searchParams,
    viewRev,
  ]);

  const fullHref = React.useMemo(
    () => diffSidebarFullHref(diffViewMode, viewRev, rev, latestRevision, section),
    [diffViewMode, latestRevision, rev, section, viewRev],
  );
  const defaultDiffPair = React.useMemo(() => defaultDiffRevisionPair(sortedAsc), [sortedAsc]);
  const diffHref = React.useMemo(
    () => {
      if (diffViewMode === "combined") {
        const nextBase = defaultDiffPair.baseRev;
        const nextCompare = combinedRev === nextBase ? defaultDiffPair.compareRev : combinedRev;
        return diffSidebarDiffHref(nextBase, nextCompare, latestRevision, section);
      }
      return diffSidebarDiffHref(baseRev, rev, latestRevision, section);
    },
    [baseRev, combinedRev, defaultDiffPair.baseRev, defaultDiffPair.compareRev, diffViewMode, latestRevision, rev, section],
  );
  const activeConfigSectionLabel = React.useMemo(() => {
    const match = navConfig?.configs.find((entry) => entry.id === section || entry.apiType === section);
    if (!match) return undefined;
    return match.displayName ?? match.navLabel ?? match.label;
  }, [navConfig, section]);

  return (
    <Card className="mx-auto flex h-[calc(100vh-3rem)] max-w-[98%] flex-col overflow-hidden p-4">
      <CardHeader className="shrink-0 px-0 pt-0 pb-3">
        <CardTitle>Configs / Diff</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-grow flex-col overflow-hidden p-0">
        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
          <DiffSidebar
            diffViewMode={diffViewMode}
            viewRev={viewRev}
            setViewRev={setViewRevAndUrl}
            baseRev={baseRev}
            setBaseRev={setBaseRevAndUrl}
            rev={rev}
            setRev={setRevAndUrl}
            latestRevision={latestRevision}
            revisionsDesc={revisionsDesc}
            revisionsLoading={revisionsLoading}
            revisionsError={revisionsError}
            archivesGamevalEnabled={archivesGamevalEnabled}
            section={section}
            setSection={setSectionAndUrl}
            fullHref={fullHref}
            diffHref={diffHref}
            deltaBadges={deltaBadges}
                navSections={navConfig}
                sectionSupport={sectionSupport}
          />

          <div className="flex min-h-0 w-full flex-grow flex-col overflow-hidden rounded-lg border bg-card">
            <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-4">
              {section === "sprites" ? (
                <DiffSpritesView
                  diffViewMode={diffViewMode}
                  combinedRev={combinedRev}
                  baseRev={baseRev}
                  rev={rev}
                />
              ) : section === "textures" ? (
                <DiffTexturesView
                  diffViewMode={diffViewMode}
                  combinedRev={combinedRev}
                  baseRev={baseRev}
                  rev={rev}
                />
              ) : section === "gamevals" ? (
                <DiffGamevalsFullView
                  section={section}
                  activeGamevalTab={gamevalTab}
                  diffViewMode={diffViewMode}
                  combinedRev={combinedRev}
                  rev={rev}
                  onSelectGamevalTab={setGamevalTab}
                />
              ) : section === "inv" ? (
                <DiffInventoryView
                  diffViewMode={diffViewMode}
                  combinedRev={combinedRev}
                  baseRev={baseRev}
                  rev={rev}
                />
              ) : isArchiveEntitySection(section) ? (
                <DiffConfigArchiveEntityView
                  key={section}
                  section={section}
                  sectionLabel={activeConfigSectionLabel}
                  diffViewMode={diffViewMode}
                  combinedRev={combinedRev}
                  baseRev={baseRev}
                  rev={rev}
                />
              ) : (
                <DiffConfigView
                  section={section}
                  sectionLabel={activeConfigSectionLabel}
                  diffViewMode={diffViewMode}
                  combinedRev={combinedRev}
                  baseRev={baseRev}
                  rev={rev}
                />
              )}
            </main>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export default function DiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DiffLayoutFallback />}>
      <DiffLayoutWithSearchParams>{children}</DiffLayoutWithSearchParams>
    </Suspense>
  );
}
