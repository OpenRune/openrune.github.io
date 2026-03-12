"use client";

import * as React from "react";
import { ChartColumn, ChevronDown, ChevronLeft, ChevronRight, Clock3, ListTree, Settings2, Share2, Upload } from "lucide-react";
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";

import { FileDropdown } from "@/components/performance/file-dropdown";
import { FramesTab } from "@/components/performance/frames-tab";
import { SettingsTab } from "@/components/performance/settings-tab";
import { ShareModal } from "@/components/performance/share-modal";
import { SummaryTab } from "@/components/performance/summary-tab";
import { TimingMapTab } from "@/components/performance/timing-map-tab";
import { UploadModal } from "@/components/performance/upload-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OptionDropdown } from "@/components/ui/option-dropdown";
import { PerPageDropdown } from "@/components/ui/per-page-dropdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildPageItems } from "@/components/performance/pagination-utils";
import { formatNumber } from "@/lib/formatting";
import type { UploadedPerformanceFile } from "@/lib/types/performance";
import {
  collectTimingKeys,
  isPerformanceSnapshot,
  parseJsonFile,
  parseJsonFiles,
  processFrames,
} from "@/lib/utils/performance";

type UploadMode = "single" | "compare";
type AnalysisTab = "summary" | "frames" | "timings" | "settings";
const SESSION_DB_NAME = "openrune-117performance";
const SESSION_STORE_NAME = "sessions";
const SESSION_KEY = "latest";
const SHARE_DATA_PARAM = "data";
const MAX_SHARE_URL_CHARS = 180_000;
const FRAME_PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

function openSessionDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(SESSION_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
        db.createObjectStore(SESSION_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function loadStoredSession(): Promise<UploadedPerformanceFile[]> {
  const db = await openSessionDb();
  if (!db) return [];

  return new Promise((resolve) => {
    const tx = db.transaction(SESSION_STORE_NAME, "readonly");
    const store = tx.objectStore(SESSION_STORE_NAME);
    const request = store.get(SESSION_KEY);

    request.onsuccess = () => {
      const normalized = normalizeStoredFiles(request.result);
      resolve(normalized);
    };
    request.onerror = () => resolve([]);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  });
}

async function saveSession(files: UploadedPerformanceFile[]): Promise<void> {
  const db = await openSessionDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const tx = db.transaction(SESSION_STORE_NAME, "readwrite");
    const store = tx.objectStore(SESSION_STORE_NAME);
    store.put(files, SESSION_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });

  db.close();
}

async function clearSession(): Promise<void> {
  const db = await openSessionDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    const tx = db.transaction(SESSION_STORE_NAME, "readwrite");
    const store = tx.objectStore(SESSION_STORE_NAME);
    store.delete(SESSION_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });

  db.close();
}

function encodeShareData(files: UploadedPerformanceFile[]): string | null {
  const payload = JSON.stringify(files.map((file) => ({
    id: file.id,
    name: file.name,
    size: file.size,
    data: file.data,
  })));
  return compressToEncodedURIComponent(payload);
}

function decodeShareData(encoded: string): UploadedPerformanceFile[] | null {
  const decoded = decompressFromEncodedURIComponent(encoded);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(decoded) as unknown;
    return normalizeStoredFiles(parsed);
  } catch {
    return null;
  }
}

function normalizeStoredFiles(value: unknown): UploadedPerformanceFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Partial<UploadedPerformanceFile>;
      if (!candidate.data || !isPerformanceSnapshot(candidate.data) || !candidate.name || !candidate.size) {
        return null;
      }
      return {
        id: candidate.id ?? `${candidate.name}-${candidate.size}-${index}`,
        name: candidate.name,
        size: candidate.size,
        data: candidate.data,
      } as UploadedPerformanceFile;
    })
    .filter((entry): entry is UploadedPerformanceFile => Boolean(entry))
    .slice(0, 2);
}

export default function Performance117Page() {
  const [files, setFiles] = React.useState<UploadedPerformanceFile[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = React.useState(true);
  const [shareModalOpen, setShareModalOpen] = React.useState(false);
  const [uploadMode, setUploadMode] = React.useState<UploadMode>("single");
  const [processing, setProcessing] = React.useState(false);
  const [frameLimit, setFrameLimit] = React.useState<number | "all">("all");
  const [frameDropdownOpen, setFrameDropdownOpen] = React.useState(false);
  const [fileDropdownOpen, setFileDropdownOpen] = React.useState(false);
  const [dropdownMode, setDropdownMode] = React.useState<UploadMode>("single");
  const [activeTab, setActiveTab] = React.useState<AnalysisTab>("summary");
  const [shareUrl, setShareUrl] = React.useState("");
  const [compareFramesPage, setCompareFramesPage] = React.useState(1);
  const [compareFramesPageSize, setCompareFramesPageSize] = React.useState<(typeof FRAME_PAGE_SIZE_OPTIONS)[number]>(20);
  const [compareTimingsPage, setCompareTimingsPage] = React.useState(1);
  const [compareTimingsPageSize, setCompareTimingsPageSize] = React.useState<(typeof FRAME_PAGE_SIZE_OPTIONS)[number]>(20);
  const [compareSelectedTiming, setCompareSelectedTiming] = React.useState("all");
  const dropdownInputRef1 = React.useRef<HTMLInputElement | null>(null);
  const dropdownInputRef2 = React.useRef<HTMLInputElement | null>(null);
  const [shareState, setShareState] = React.useState<{
    loading: boolean;
    error: string | null;
    copied: boolean;
  }>({
    loading: false,
    error: null,
    copied: false,
  });

  const processedByFile = React.useMemo(
    () => files.map((file) => processFrames(file.data.frames, frameLimit)),
    [files, frameLimit],
  );

  const combinedFrames = React.useMemo(
    () => processedByFile.flatMap((entry) => entry),
    [processedByFile],
  );

  const timingKeysByFile = React.useMemo(
    () => processedByFile.map((entry) => collectTimingKeys(entry)),
    [processedByFile],
  );

  const timingKeys = React.useMemo(
    () => collectTimingKeys(combinedFrames),
    [combinedFrames],
  );

  const isCompareMode = files.length > 1;
  const compareFramesTotalRows = React.useMemo(
    () => Math.max(processedByFile[0]?.length ?? 0, processedByFile[1]?.length ?? 0),
    [processedByFile],
  );
  const compareFramesTotalPages = React.useMemo(
    () => Math.max(1, Math.ceil(compareFramesTotalRows / compareFramesPageSize)),
    [compareFramesPageSize, compareFramesTotalRows],
  );
  const compareFramesSafePage = Math.min(Math.max(compareFramesPage, 1), compareFramesTotalPages);
  const compareFramePageItems = React.useMemo(
    () => buildPageItems(compareFramesSafePage, compareFramesTotalPages),
    [compareFramesSafePage, compareFramesTotalPages],
  );
  const compareTimingOptions = React.useMemo(
    () => [{ value: "all", label: "All timings" }, ...timingKeys.map((key) => ({ value: key, label: key }))],
    [timingKeys],
  );
  const compareTimingsTotalColumns = React.useMemo(
    () => Math.max(processedByFile[0]?.length ?? 0, processedByFile[1]?.length ?? 0),
    [processedByFile],
  );
  const compareTimingsTotalPages = React.useMemo(
    () => Math.max(1, Math.ceil(compareTimingsTotalColumns / compareTimingsPageSize)),
    [compareTimingsPageSize, compareTimingsTotalColumns],
  );
  const compareTimingsSafePage = Math.min(Math.max(compareTimingsPage, 1), compareTimingsTotalPages);
  const compareTimingPageItems = React.useMemo(
    () => buildPageItems(compareTimingsSafePage, compareTimingsTotalPages),
    [compareTimingsSafePage, compareTimingsTotalPages],
  );

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (frameDropdownOpen && target && !target.closest(".frame-dropdown")) {
        setFrameDropdownOpen(false);
      }
      if (fileDropdownOpen && target && !target.closest(".file-dropdown")) {
        setFileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [fileDropdownOpen, frameDropdownOpen]);

  React.useEffect(() => {
    setCompareFramesPage(1);
  }, [compareFramesPageSize, files]);

  React.useEffect(() => {
    setCompareTimingsPage(1);
  }, [compareTimingsPageSize, compareSelectedTiming, files]);

  const loadFromShare = React.useCallback((id: string) => {
    const loaded = decodeShareData(id);
    if (!loaded || loaded.length === 0) {
      setShareState({
        loading: false,
        error: "This share link is invalid or corrupted.",
        copied: false,
      });
      return;
    }

    setFiles(loaded);
    setUploadMode(loaded.length > 1 ? "compare" : "single");
    setDropdownMode(loaded.length > 1 ? "compare" : "single");
    setUploadModalOpen(false);
    setShareState({ loading: false, error: null, copied: false });
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get(SHARE_DATA_PARAM);
    if (shareData) {
      void loadFromShare(shareData);
      return;
    }

    let cancelled = false;
    void (async () => {
      const restoredFiles = await loadStoredSession();
      if (cancelled) return;
      if (restoredFiles.length === 0) return;
      setFiles(restoredFiles);
      setUploadMode(restoredFiles.length > 1 ? "compare" : "single");
      setDropdownMode(restoredFiles.length > 1 ? "compare" : "single");
      setUploadModalOpen(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadFromShare]);

  React.useEffect(() => {
    void (async () => {
      if (files.length === 0) {
        await clearSession();
        return;
      }
      await saveSession(files);
    })();
  }, [files]);

  const replaceFile = async (file: File | null, index: number) => {
    if (!file) return;
    const parsed = await parseJsonFile(file);
    if (!parsed) return;
    setFiles((prev) => {
      const next = [...prev];
      next[index] = parsed;
      return next.filter(Boolean).slice(0, 2);
    });
  };

  const uploadBatch = async (incomingFiles: FileList | null, maxFiles: number) => {
    const parsed = await parseJsonFiles(incomingFiles, maxFiles);
    if (parsed.length === 0) return;
    setFiles(parsed.slice(0, maxFiles));
  };

  const confirmUpload = () => {
    setProcessing(true);
    window.setTimeout(() => {
      setProcessing(false);
      setUploadModalOpen(false);
    }, 500);
  };

  const createShareLink = async () => {
    if (files.length === 0) return;
    setShareState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      const encoded = encodeShareData(files);
      if (!encoded) {
        throw new Error("Failed to encode share payload");
      }
      if (encoded.length > MAX_SHARE_URL_CHARS) {
        setShareState((previous) => ({
          ...previous,
          loading: false,
          error: "This dataset is too large for URL sharing. Try fewer frames.",
        }));
        return;
      }

      const url = `${window.location.origin}${window.location.pathname}?${SHARE_DATA_PARAM}=${encoded}`;
      setShareUrl(url);
      setShareModalOpen(true);
      setShareState((previous) => ({ ...previous, loading: false, error: null, copied: false }));
    } catch {
      setShareState((previous) => ({
        ...previous,
        loading: false,
        error: "Failed to create a compressed share link.",
      }));
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setShareState((previous) => ({ ...previous, copied: true }));
    window.setTimeout(() => {
      setShareState((previous) => ({ ...previous, copied: false }));
    }, 1800);
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col gap-4 overflow-y-auto px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">117 Performance</h1>
          <p className="text-sm text-muted-foreground">
            Offline-ready: upload one or two 117 HD performance snapshots and compare CPU/GPU timing.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
          {files.length > 0 ? (
            <>
              <div className="relative frame-dropdown">
                <Button variant="outline" className="flex items-center gap-2" onClick={() => setFrameDropdownOpen((prev) => !prev)}>
                  <ChartColumn className="size-4" />
                  {frameLimit === "all" ? "All Frames" : `${frameLimit} Frames`}
                  <ChevronDown className="size-4" />
                </Button>
                {frameDropdownOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border bg-popover shadow-lg">
                    <div className="space-y-1 p-2">
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Frame Limit</div>
                      {(["all", 20, 40, 60, 80, 100, 120, 140, 160, 180, 200] as const).map((limit) => (
                        <button
                          key={limit}
                          className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-muted ${frameLimit === limit ? "bg-muted font-medium" : ""}`}
                          onClick={() => {
                            setFrameLimit(limit);
                            setFrameDropdownOpen(false);
                          }}
                        >
                          {limit === "all" ? "All Frames" : `${limit} Frames`}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <Button variant="outline" onClick={() => void createShareLink()} disabled={shareState.loading}>
                <Share2 className="mr-2 size-4" />
                Share
              </Button>
              <FileDropdown
                open={fileDropdownOpen}
                onToggle={() => setFileDropdownOpen((prev) => !prev)}
                files={files}
                mode={dropdownMode}
                onModeChange={(mode) => {
                  setDropdownMode(mode);
                  setUploadMode(mode);
                }}
                onUploadSingle={replaceFile}
                onRemove={(index) => setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                inputRef1={dropdownInputRef1}
                inputRef2={dropdownInputRef2}
              />
            </>
          ) : (
            <Button variant="outline" onClick={() => setUploadModalOpen(true)}>
              <Upload className="mr-2 size-4" />
              Upload Files
            </Button>
          )}
          </div>
          {files.length > 0 ? (
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Badge variant="secondary" className="max-w-[18rem] truncate">
                {files[0]?.name ?? "File 1"}
              </Badge>
              {files[1] ? (
                <>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <Badge variant="secondary" className="max-w-[18rem] truncate">
                    {files[1].name}
                  </Badge>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {shareState.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {shareState.error}
        </div>
      ) : null}
      {shareState.copied ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          Share link copied to clipboard.
        </div>
      ) : null}

      {files.length > 0 && !uploadModalOpen ? (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AnalysisTab)} className="min-h-0 flex-1">
          <TabsList className="mb-2 grid w-full grid-cols-4">
            <TabsTrigger value="summary">
              <ChartColumn className="mr-2 size-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="frames">
              <Clock3 className="mr-2 size-4" />
              Frames
            </TabsTrigger>
            <TabsTrigger value="timings">
              <ListTree className="mr-2 size-4" />
              Timings
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings2 className="mr-2 size-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="min-h-0">
            {activeTab === "summary" && isCompareMode ? (
              <div className="grid gap-5 xl:grid-cols-2">
                <SummaryTab frames={processedByFile[0] ?? []} snapshot={files[0]?.data ?? null} title={files[0]?.name} />
                <SummaryTab frames={processedByFile[1] ?? []} snapshot={files[1]?.data ?? null} title={files[1]?.name} />
              </div>
            ) : activeTab === "summary" ? (
              <SummaryTab frames={processedByFile[0] ?? []} snapshot={files[0]?.data ?? null} />
            ) : null}
          </TabsContent>

          <TabsContent value="frames" className="flex min-h-0 flex-1 flex-col">
            {activeTab === "frames" && isCompareMode ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-2">
                  <div className="flex min-h-0 flex-col gap-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{files[0]?.name}</h3>
                    <FramesTab
                      frames={processedByFile[0] ?? []}
                      page={compareFramesSafePage}
                      pageSize={compareFramesPageSize}
                      hidePaginationUI
                    />
                  </div>
                  <div className="flex min-h-0 flex-col gap-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{files[1]?.name}</h3>
                    <FramesTab
                      frames={processedByFile[1] ?? []}
                      page={compareFramesSafePage}
                      pageSize={compareFramesPageSize}
                      hidePaginationUI
                    />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Per page</span>
                    <PerPageDropdown
                      value={compareFramesPageSize}
                      options={FRAME_PAGE_SIZE_OPTIONS}
                      onChange={(value) => setCompareFramesPageSize(value as (typeof FRAME_PAGE_SIZE_OPTIONS)[number])}
                    />
                  </div>
                  <div className="flex-1 text-center text-xs text-muted-foreground">
                    Showing {formatNumber(Math.min(compareFramesPageSize, compareFramesTotalRows))} of {formatNumber(compareFramesTotalRows)} rows
                    <span className="mx-2">|</span>
                    Page {formatNumber(compareFramesSafePage)} / {formatNumber(compareFramesTotalPages)}
                  </div>
                  <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-1">
                    <Button
                      size="icon-xs"
                      variant="outline"
                      disabled={compareFramesSafePage <= 1}
                      onClick={() => setCompareFramesPage((prev) => Math.max(1, prev - 1))}
                      aria-label="Go to previous page"
                      title="Previous page"
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {compareFramePageItems.map((item, index) =>
                        item === "ellipsis" ? (
                          <span key={`compare-ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
                            ...
                          </span>
                        ) : (
                          <Button
                            key={item}
                            size="sm"
                            variant={item === compareFramesSafePage ? "default" : "outline"}
                            className="h-7 min-w-7 px-2 text-xs"
                            onClick={() => setCompareFramesPage(item)}
                            aria-label={`Go to page ${item}`}
                          >
                            {item}
                          </Button>
                        ),
                      )}
                    </div>
                    <Button
                      size="icon-xs"
                      variant="outline"
                      disabled={compareFramesSafePage >= compareFramesTotalPages}
                      onClick={() => setCompareFramesPage((prev) => Math.min(compareFramesTotalPages, prev + 1))}
                      aria-label="Go to next page"
                      title="Next page"
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : activeTab === "frames" ? (
              <FramesTab frames={processedByFile[0] ?? []} />
            ) : null}
          </TabsContent>

          <TabsContent value="timings" className="min-h-0">
            {activeTab === "timings" && isCompareMode ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium">Timing</label>
                  <OptionDropdown
                    value={compareSelectedTiming}
                    options={compareTimingOptions}
                    onChange={setCompareSelectedTiming}
                    className="w-[22rem]"
                    buttonClassName="h-9 text-sm"
                    ariaLabel="Select timing key"
                  />
                </div>
                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{files[0]?.name}</h3>
                    <TimingMapTab
                      frames={processedByFile[0] ?? []}
                      timingKeys={timingKeysByFile[0] ?? []}
                      selectedTiming={compareSelectedTiming}
                      page={compareTimingsSafePage}
                      pageSize={compareTimingsPageSize}
                      hideTimingSelector
                      hidePaginationUI
                    />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{files[1]?.name}</h3>
                    <TimingMapTab
                      frames={processedByFile[1] ?? []}
                      timingKeys={timingKeysByFile[1] ?? []}
                      selectedTiming={compareSelectedTiming}
                      page={compareTimingsSafePage}
                      pageSize={compareTimingsPageSize}
                      hideTimingSelector
                      hidePaginationUI
                    />
                  </div>
                </div>
                {compareSelectedTiming === "all" ? (
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Per page</span>
                    <PerPageDropdown
                      value={compareTimingsPageSize}
                      options={FRAME_PAGE_SIZE_OPTIONS}
                      onChange={(value) => setCompareTimingsPageSize(value as (typeof FRAME_PAGE_SIZE_OPTIONS)[number])}
                    />
                  </div>
                  <div className="flex-1 text-center text-xs text-muted-foreground">
                    Showing {formatNumber(Math.min(compareTimingsPageSize, compareTimingsTotalColumns))} of {formatNumber(compareTimingsTotalColumns)} columns
                    <span className="mx-2">|</span>
                    Page {formatNumber(compareTimingsSafePage)} / {formatNumber(compareTimingsTotalPages)}
                  </div>
                  <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-1">
                    <Button
                      size="icon-xs"
                      variant="outline"
                      disabled={compareTimingsSafePage <= 1}
                      onClick={() => setCompareTimingsPage((prev) => Math.max(1, prev - 1))}
                      aria-label="Go to previous page"
                      title="Previous page"
                    >
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {compareTimingPageItems.map((item, index) =>
                        item === "ellipsis" ? (
                          <span key={`compare-timing-ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
                            ...
                          </span>
                        ) : (
                          <Button
                            key={item}
                            size="sm"
                            variant={item === compareTimingsSafePage ? "default" : "outline"}
                            className="h-7 min-w-7 px-2 text-xs"
                            onClick={() => setCompareTimingsPage(item)}
                            aria-label={`Go to page ${item}`}
                          >
                            {item}
                          </Button>
                        ),
                      )}
                    </div>
                    <Button
                      size="icon-xs"
                      variant="outline"
                      disabled={compareTimingsSafePage >= compareTimingsTotalPages}
                      onClick={() => setCompareTimingsPage((prev) => Math.min(compareTimingsTotalPages, prev + 1))}
                      aria-label="Go to next page"
                      title="Next page"
                    >
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
                ) : null}
              </div>
            ) : activeTab === "timings" ? (
              <TimingMapTab frames={processedByFile[0] ?? []} timingKeys={timingKeys} />
            ) : null}
          </TabsContent>

          <TabsContent value="settings" className="flex min-h-0 flex-1 flex-col">
            {activeTab === "settings" && isCompareMode ? (
              <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-2">
                <div className="flex min-h-0 flex-col gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{files[0]?.name}</h3>
                  <SettingsTab settings={files[0]?.data?.settings ?? null} />
                </div>
                <div className="flex min-h-0 flex-col gap-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{files[1]?.name}</h3>
                  <SettingsTab settings={files[1]?.data?.settings ?? null} />
                </div>
              </div>
            ) : activeTab === "settings" ? (
              <SettingsTab settings={files[0]?.data?.settings ?? null} />
            ) : null}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Upload JSON files to start the analysis.
        </div>
      )}

      <UploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        mode={uploadMode}
        onModeChange={setUploadMode}
        files={files}
        isProcessing={processing}
        onUploadSingle={replaceFile}
        onUploadBatch={uploadBatch}
        onRemove={(index) => setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
        onConfirm={confirmUpload}
      />

      <ShareModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        url={shareUrl}
        onCopy={copyShareLink}
      />
    </div>
  );
}
