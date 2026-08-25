"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  diffWorkbenchSearchString,
  resolveDiffSectionFromUrl,
  REVISIONS_FALLBACK,
} from "@/components/diff/diff-constants";
import { copyFocusParam } from "@/components/diff/diff-focus-url";
import { copySpriteViewerParams } from "@/components/diff/diff-sprite-viewer-url";
import { parseSectionSupportManifest, type SectionSupportManifest } from "@/components/diff/diff-section-support";
import type { DiffMode, Section } from "@/components/diff/diff-types";
import { isArchiveEntitySection } from "@/components/diff/diff-openrune-archive-columns";
import { useCacheType } from "@/context/cache-type-context";
import {
  diffCacheOrderedPair,
  diffDeltaSpritesSummaryUrl,
  diffDeltaSummaryUrl,
  diffRevisionsUrl,
  diffSupportManifestUrl,
  parseDiffRevisionsResponse,
} from "@/lib/cache-api-client";
import { mergeDeltaBadgeMaps, type DeltaBadgeMap } from "@/lib/diff-delta-merge";
import { cacheNavUrl, parseNavConfig, type NavConfig } from "@/lib/nav-config";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";

/** Explorer-only view mode in the URL (`full` = single cache rev, `diff` = base/compare). */
export const DIFF_EXPLORER_URL_PARAM_MODE = "mode";

const DIFF_EXPLORER_MODE_STORAGE_KEY = "openrune.diff-explorer.mode.v1";

function normalizeQueryString(qs: string): string {
  const u = new URLSearchParams(qs);
  return [...u.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
}

function readStoredExplorerMode(): DiffMode {
  if (typeof window === "undefined") return "diff";
  try {
    const raw = window.localStorage.getItem(DIFF_EXPLORER_MODE_STORAGE_KEY);
    if (raw === "full" || raw === "combined") return "combined";
    if (raw === "diff") return "diff";
  } catch {
    // ignore quota / private mode
  }
  return "diff";
}

function writeStoredExplorerMode(mode: DiffMode) {
  try {
    window.localStorage.setItem(DIFF_EXPLORER_MODE_STORAGE_KEY, mode === "combined" ? "full" : "diff");
  } catch {
    // ignore quota / private mode
  }
}

/** Explicit URL values win; missing `mode` falls back to the last chosen Full/Diff. */
function resolveExplorerMode(raw: string | null): DiffMode {
  if (raw === "full" || raw === "combined") return "combined";
  if (raw === "diff") return "diff";
  return readStoredExplorerMode();
}

/**
 * Diff explorer state: advanced shell with local Full (no compare) vs Diff (base/compare).
 */
export function useDiffExplorerState() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = DIFF_ROUTE_DIFFVIEW;
  const { selectedCacheType } = useCacheType();

  const revisionsFetchSeq = React.useRef(0);
  const deltaFetchSeq = React.useRef(0);

  const [deltaBadges, setDeltaBadges] = React.useState<DeltaBadgeMap | null>(null);
  const [navConfig, setNavConfig] = React.useState<NavConfig | null>(null);
  const [sectionSupport, setSectionSupport] = React.useState<SectionSupportManifest | null>(null);

  const [mode, setMode] = React.useState<DiffMode>(() => readStoredExplorerMode());
  const [viewRev, setViewRev] = React.useState<"latest" | number>("latest");
  const [baseRev, setBaseRev] = React.useState(REVISIONS_FALLBACK[0]!);
  const [rev, setRev] = React.useState(REVISIONS_FALLBACK[REVISIONS_FALLBACK.length - 1]!);
  const [section, setSection] = React.useState<Section>(DIFF_DEFAULT_SECTION);

  const [revisions, setRevisions] = React.useState<number[]>(REVISIONS_FALLBACK);
  const [revisionsLoading, setRevisionsLoading] = React.useState(true);
  const [revisionsError, setRevisionsError] = React.useState<string | null>(null);

  const sortedAsc = React.useMemo(
    () => [...new Set(revisions)].filter((n) => Number.isFinite(n)).sort((a, b) => a - b),
    [revisions],
  );

  const latestRevision =
    sortedAsc.length > 0 ? sortedAsc[sortedAsc.length - 1]! : REVISIONS_FALLBACK[REVISIONS_FALLBACK.length - 1]!;

  const revisionsDesc = React.useMemo(() => [...sortedAsc].sort((a, b) => b - a), [sortedAsc]);
  const revisionsFingerprint = sortedAsc.join(",");
  const revisionsReady = !revisionsLoading && sortedAsc.length > 0;

  const combinedRev = viewRev === "latest" ? latestRevision : viewRev;
  const activeRevisionForSupport = mode === "combined" ? combinedRev : rev;

  const replaceExplorerUrl = React.useCallback(
    (
      nextMode: DiffMode,
      nextView: "latest" | number,
      nextBase: number,
      nextTo: number,
      nextSection: Section,
    ) => {
      const params = new URLSearchParams(
        diffWorkbenchSearchString({
          mode: nextMode,
          viewRev: nextView,
          baseRev: nextBase,
          rev: nextTo,
          latestRevision,
          section: nextSection,
        }),
      );
      params.delete("view");
      if (nextMode === "combined") {
        params.set(DIFF_EXPLORER_URL_PARAM_MODE, "full");
      } else {
        params.delete(DIFF_EXPLORER_URL_PARAM_MODE);
      }
      if (nextSection === "sprites") {
        copySpriteViewerParams(searchParams, params);
      } else {
        const currentSection =
          searchParams.get(DIFF_URL_PARAM_SECTION)?.trim().toLowerCase() || DIFF_DEFAULT_SECTION;
        // Keep quick-hop target across rev/mode changes; drop it when the section changes.
        if (currentSection === nextSection) {
          copyFocusParam(searchParams, params);
        }
      }
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (normalizeQueryString(qs) !== normalizeQueryString(searchParams.toString())) {
        router.replace(href, { scroll: false });
      }
    },
    [latestRevision, pathname, router, searchParams],
  );

  const setModeAndUrl = React.useCallback(
    (next: DiffMode) => {
      if (next === mode) return;
      writeStoredExplorerMode(next);
      if (next === "combined") {
        const nextView: "latest" | number = rev === latestRevision ? "latest" : rev;
        setMode("combined");
        setViewRev(nextView);
        replaceExplorerUrl("combined", nextView, baseRev, rev, section);
        return;
      }
      const compare = viewRev === "latest" ? latestRevision : viewRev;
      const { baseRev: defaultBase, compareRev: defaultCompare } = defaultDiffRevisionPair(sortedAsc);
      const nextBase =
        sortedAsc.includes(baseRev) && baseRev !== compare
          ? baseRev
          : sortedAsc.includes(defaultBase) && defaultBase !== compare
            ? defaultBase
            : defaultCompare !== compare
              ? defaultCompare
              : baseRev;
      const nextCompare = sortedAsc.includes(compare) ? compare : defaultCompare;
      setMode("diff");
      setBaseRev(nextBase);
      setRev(nextCompare);
      replaceExplorerUrl("diff", viewRev, nextBase, nextCompare, section);
    },
    [baseRev, latestRevision, mode, replaceExplorerUrl, rev, section, sortedAsc, viewRev],
  );

  const setViewRevAndUrl = React.useCallback(
    (v: "latest" | number) => {
      setViewRev(v);
      if (mode === "combined") replaceExplorerUrl("combined", v, baseRev, rev, section);
    },
    [baseRev, mode, replaceExplorerUrl, rev, section],
  );

  const setBaseRevAndUrl = React.useCallback(
    (b: number) => {
      setBaseRev(b);
      if (mode === "diff") replaceExplorerUrl("diff", viewRev, b, rev, section);
    },
    [mode, replaceExplorerUrl, rev, section, viewRev],
  );

  const setRevAndUrl = React.useCallback(
    (t: number) => {
      setRev(t);
      if (mode === "diff") replaceExplorerUrl("diff", viewRev, baseRev, t, section);
    },
    [baseRev, mode, replaceExplorerUrl, section, viewRev],
  );

  const setSectionAndUrl = React.useCallback(
    (next: Section) => {
      setSection(next);
      replaceExplorerUrl(mode, viewRev, baseRev, rev, next);
    },
    [baseRev, mode, replaceExplorerUrl, rev, viewRev],
  );

  React.useEffect(() => {
    async function loadNav() {
      try {
        const navRes = await fetch(cacheNavUrl(selectedCacheType), { cache: "no-store" });
        if (navRes.ok) {
          const parsed = parseNavConfig(await navRes.json());
          if (parsed) {
            setNavConfig(parsed);
            applyNavConfigSections(parsed);
          }
        }
      } catch {
        // repository falls back to static config
      }
    }
    void loadNav();
  }, [selectedCacheType]);

  React.useEffect(() => {
    const key = `diff:support:manifest:${selectedCacheType.id}:${activeRevisionForSupport}`;
    void (async () => {
      try {
        const { data } = await conditionalJsonFetch<unknown>(
          key,
          diffSupportManifestUrl(selectedCacheType, activeRevisionForSupport),
        );
        setSectionSupport(parseSectionSupportManifest(data));
      } catch {
        setSectionSupport(null);
      }
    })();
  }, [activeRevisionForSupport, selectedCacheType]);

  React.useEffect(() => {
    if (!sectionSupport) return;
    const isArchive = section === "sprites" || section === "textures" || section === "gamevals";
    const supported = isArchive
      ? sectionSupport.archives[section] !== false
      : sectionSupport.configs[section] !== false;
    if (supported) return;

    const configCandidates = navConfig?.configs.map((entry) => entry.id) ?? Object.keys(sectionSupport.configs);
    const archiveCandidates =
      navConfig?.archives.map((entry) => entry.id).filter((id) => id !== "gamevals") ??
      Object.keys(sectionSupport.archives).filter((id) => id !== "gamevals");
    const fallbackConfig = configCandidates.find((id) => sectionSupport.configs[id] !== false);
    const fallbackArchive = archiveCandidates.find((id) => sectionSupport.archives[id] !== false);
    const nextSection = (fallbackConfig ?? fallbackArchive ?? DIFF_DEFAULT_SECTION) as Section;
    if (nextSection !== section) setSectionAndUrl(nextSection);
  }, [navConfig, section, sectionSupport, setSectionAndUrl]);

  React.useEffect(() => {
    if (section !== "gamevals" && !section.startsWith("gamevals_")) return;
    setSectionAndUrl(DIFF_DEFAULT_SECTION);
  }, [section, setSectionAndUrl]);

  React.useEffect(() => {
    const seq = ++revisionsFetchSeq.current;
    async function load() {
      setRevisionsLoading(true);
      setRevisionsError(null);
      try {
        const response = await fetch(diffRevisionsUrl(selectedCacheType), { cache: "no-store" });
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
    if (mode !== "diff" || baseRev === rev) {
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
            diffDeltaSummaryUrl(selectedCacheType, params),
          ),
          conditionalJsonFetch<{ added?: number; changed?: number; removed?: number }>(
            sprKey,
            diffDeltaSpritesSummaryUrl(selectedCacheType, params),
          ),
        ]);
        if (seq !== deltaFetchSeq.current) return;
        setDeltaBadges(mergeDeltaBadgeMaps(DELTA_COUNTS as DeltaBadgeMap, cfg.data?.configs, spr.data));
      } catch {
        if (seq !== deltaFetchSeq.current) return;
        setDeltaBadges(null);
      }
    })();
  }, [mode, baseRev, rev, selectedCacheType.id]);

  React.useEffect(() => {
    if (!revisionsReady) return;

    const rawModeParam = searchParams.get(DIFF_EXPLORER_URL_PARAM_MODE);
    const urlMode = resolveExplorerMode(rawModeParam);
    writeStoredExplorerMode(urlMode);
    const { baseRev: defaultBase, compareRev: defaultCompare } = defaultDiffRevisionPair(sortedAsc);

    if (urlMode === "combined") {
      setMode((cur) => (cur === "combined" ? cur : "combined"));
      const raw = searchParams.get(DIFF_URL_PARAM_REV);
      if (raw == null || raw === "") {
        setViewRev((cur) => (cur === "latest" ? cur : "latest"));
        // Restore Full into the URL when returning without `mode=full`.
        if (rawModeParam == null) {
          replaceExplorerUrl("combined", "latest", baseRev, rev, section);
        }
        return;
      }
      const n = Number(raw);
      if (Number.isFinite(n) && sortedAsc.includes(n)) {
        if (n === latestRevision) {
          setViewRev((cur) => (cur === "latest" ? cur : "latest"));
          replaceExplorerUrl("combined", "latest", baseRev, rev, section);
        } else {
          setViewRev((cur) => (cur === n ? cur : n));
          if (rawModeParam == null) {
            replaceExplorerUrl("combined", n, baseRev, rev, section);
          }
        }
      } else {
        setViewRev("latest");
        replaceExplorerUrl("combined", "latest", baseRev, rev, section);
      }
      return;
    }

    setMode((cur) => (cur === "diff" ? cur : "diff"));

    const baseRaw = searchParams.get(DIFF_URL_PARAM_BASE) ?? searchParams.get(DIFF_URL_PARAM_FROM);
    const compareRaw = searchParams.get(DIFF_URL_PARAM_COMPARE) ?? searchParams.get(DIFF_URL_PARAM_TO);
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
          ? resolveDiffSectionFromUrl(rawSection, false, nextTo)
          : section;
      const rewrittenSection =
        rawSection != null &&
        rawSection !== "" &&
        resolvedSection === DIFF_DEFAULT_SECTION &&
        rawSection !== DIFF_DEFAULT_SECTION &&
        isArchiveEntitySection(rawSection)
          ? rawSection
          : resolvedSection;
      replaceExplorerUrl("diff", viewRev, nextBase, nextTo, rewrittenSection);
    }
  }, [
    revisionsReady,
    sortedAsc,
    searchParams,
    latestRevision,
    baseRev,
    rev,
    replaceExplorerUrl,
    viewRev,
    section,
  ]);

  React.useEffect(() => {
    const raw = searchParams.get(DIFF_URL_PARAM_SECTION);
    if (raw == null || raw === "") return;

    if (raw.startsWith("gamevals_") || raw === "gamevals") {
      if (revisionsReady) replaceExplorerUrl(mode, viewRev, baseRev, rev, DIFF_DEFAULT_SECTION);
      return;
    }

    const resolved = resolveDiffSectionFromUrl(raw, false, activeRevisionForSupport);
    const preserveRawArchiveSection =
      resolved === DIFF_DEFAULT_SECTION && raw !== DIFF_DEFAULT_SECTION && isArchiveEntitySection(raw);
    const nextSection = preserveRawArchiveSection ? (raw as Section) : resolved;
    setSection((cur) => (cur === nextSection ? cur : nextSection));

    if (revisionsReady && !preserveRawArchiveSection && raw !== resolved) {
      replaceExplorerUrl(mode, viewRev, baseRev, rev, resolved);
    }
  }, [
    activeRevisionForSupport,
    baseRev,
    mode,
    replaceExplorerUrl,
    revisionsReady,
    rev,
    searchParams,
    viewRev,
  ]);

  const activeConfigSectionLabel = React.useMemo(() => {
    const match = navConfig?.configs.find((entry) => entry.id === section || entry.apiType === section);
    if (!match) return undefined;
    return match.displayName ?? match.navLabel ?? match.label;
  }, [navConfig, section]);

  return {
    mode,
    setMode: setModeAndUrl,
    viewRev,
    setViewRev: setViewRevAndUrl,
    combinedRev,
    baseRev,
    setBaseRev: setBaseRevAndUrl,
    rev,
    setRev: setRevAndUrl,
    section,
    setSection: setSectionAndUrl,
    latestRevision,
    revisionsDesc,
    revisionsLoading,
    revisionsError,
    deltaBadges: mode === "diff" ? deltaBadges : null,
    navConfig,
    sectionSupport,
    activeConfigSectionLabel,
  };
}
