"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Download, GripVertical, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCacheType } from "@/context/cache-type-context";
import { cacheProxyHeaders, diffCacheOrderedPair } from "@/lib/cache-proxy-client";
import { SseEventType } from "@/lib/sse/types";
import type { ZipProgressSsePayload } from "@/lib/sse/types";
import {
  defaultZipFilename,
  parseZipCreateResponse,
  type ZipArchiveKind,
  zipCancelUrl,
  zipCreateUrl,
  zipProgressUrl,
  triggerZipDownload,
} from "@/lib/zip-download";
import type { DiffMode } from "@/components/diff/diff-types";
import type { CacheType } from "@/lib/cache-types";

const POLL_MS = 1500;
const PANEL_POS_KEY = "openrune:zip-panel-pos";
const PANEL_W = 320;

export type StartZipExportOpts = {
  kind: ZipArchiveKind;
  diffViewMode: DiffMode;
  combinedRev: number;
  baseRev: number;
  rev: number;
  tableBase?: number;
};

type Phase = "creating" | "building" | "done" | "error";

type DownloadItem = {
  id: string;
  kind: ZipArchiveKind;
  jobId: string | null;
  phase: Phase;
  progress: number;
  message: string;
  downloadUrl: string | null;
  errorText: string | null;
  rangeLabel: string;
  expanded: boolean;
  opts: StartZipExportOpts;
};

function isZipProgressPayload(data: unknown): data is ZipProgressSsePayload {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return typeof o.jobId === "string" && typeof o.progress === "number";
}

type ZipDownloadContextValue = {
  startZipExport: (opts: StartZipExportOpts) => void;
};

const ZipDownloadContext = React.createContext<ZipDownloadContextValue | null>(null);

export function useZipDownload(): ZipDownloadContextValue {
  const ctx = React.useContext(ZipDownloadContext);
  if (!ctx) throw new Error("useZipDownload must be used within ZipDownloadProvider");
  return ctx;
}

function readSavedPos(): { left: number; top: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PANEL_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { left?: number; top?: number };
    if (typeof p.left !== "number" || typeof p.top !== "number") return null;
    return { left: p.left, top: p.top };
  } catch {
    return null;
  }
}

function defaultPos(): { left: number; top: number } {
  if (typeof window === "undefined") return { left: 24, top: 120 };
  return {
    left: Math.max(16, window.innerWidth - PANEL_W - 24),
    top: Math.max(16, window.innerHeight - 240),
  };
}

let downloadIdCounter = 0;

export function ZipDownloadProvider({ children }: { children: React.ReactNode }) {
  const { selectedCacheType } = useCacheType();

  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [isFadingOut, setIsFadingOut] = React.useState(false);
  const [downloads, setDownloads] = React.useState<DownloadItem[]>([]);
  const [pos, setPos] = React.useState<{ left: number; top: number }>(() => defaultPos());

  const posDragRef = React.useRef(pos);
  posDragRef.current = pos;
  const fadeTimerRef = React.useRef<number | null>(null);
  const sseMap = React.useRef<Map<string, EventSource>>(new Map());
  const pollMap = React.useRef<Map<string, number>>(new Map());
  const didDownloadSet = React.useRef<Set<string>>(new Set());

  const dragRef = React.useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
  } | null>(null);

  const clampPos = React.useCallback((left: number, top: number) => {
    if (typeof window === "undefined") return { left, top };
    const maxL = Math.max(16, window.innerWidth - PANEL_W - 8);
    const maxT = Math.max(16, window.innerHeight - 80);
    return {
      left: Math.min(maxL, Math.max(8, left)),
      top: Math.min(maxT, Math.max(8, top)),
    };
  }, []);

  React.useEffect(() => {
    setMounted(true);
    const saved = readSavedPos();
    if (saved) setPos(clampPos(saved.left, saved.top));
  }, [clampPos]);

  React.useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p.left, p.top));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPos]);

  React.useEffect(() => {
    return () => {
      sseMap.current.forEach((s) => s.close());
      pollMap.current.forEach((p) => window.clearInterval(p));
      if (fadeTimerRef.current != null) window.clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const cleanupItem = React.useCallback((id: string) => {
    const sse = sseMap.current.get(id);
    if (sse) { sse.close(); sseMap.current.delete(id); }
    const poll = pollMap.current.get(id);
    if (poll != null) { window.clearInterval(poll); pollMap.current.delete(id); }
  }, []);

  const scheduleAutoClose = React.useCallback((items: DownloadItem[]) => {
    const allDone = items.length > 0 && items.every((d) => d.phase === "done" || d.phase === "error");
    if (!allDone) return;
    if (fadeTimerRef.current != null) return;
    fadeTimerRef.current = window.setTimeout(() => {
      setIsFadingOut(true);
      window.setTimeout(() => {
        setOpen(false);
        setDownloads([]);
        setIsFadingOut(false);
        setCollapsed(false);
        fadeTimerRef.current = null;
        didDownloadSet.current.clear();
      }, 300);
    }, 3000);
  }, []);

  const applyProgress = React.useCallback(
    (id: string, jobId: string, p: number, msg: string, dl: string | null, cacheType: Pick<CacheType, "ip" | "port">) => {
      setDownloads((prev) => {
        const item = prev.find((d) => d.id === id);
        if (!item || item.jobId !== jobId) return prev;
        const progress = Math.min(100, Math.max(0, p));
        const ready = dl != null && dl.length > 0 && progress >= 99.5;
        const phase: Phase = ready ? "done" : "building";
        const next = prev.map((d) =>
          d.id === id ? { ...d, progress, message: msg, downloadUrl: dl ?? d.downloadUrl, phase } : d,
        );
        if (ready && !didDownloadSet.current.has(id)) {
          didDownloadSet.current.add(id);
          triggerZipDownload(cacheType, dl!, defaultZipFilename(jobId));
          cleanupItem(id);
          scheduleAutoClose(next);
        }
        return next;
      });
    },
    [cleanupItem, scheduleAutoClose],
  );

  const startPollFallback = React.useCallback(
    (id: string, jobId: string, cacheType: Pick<CacheType, "ip" | "port">) => {
      if (pollMap.current.has(id)) return;
      const pollFn = async () => {
        try {
          const res = await fetch(zipProgressUrl(jobId), { headers: cacheProxyHeaders(cacheType), cache: "no-store" });
          if (!res.ok) return;
          const d = (await res.json()) as { progress?: number; message?: string; downloadUrl?: string | null };
          applyProgress(id, jobId, d.progress ?? 0, d.message ?? "", d.downloadUrl ?? null, cacheType);
        } catch { /* ignore */ }
      };
      void pollFn();
      pollMap.current.set(id, window.setInterval(pollFn, POLL_MS));
    },
    [applyProgress],
  );

  const startSseForItem = React.useCallback(
    (id: string, jobId: string, cacheType: Pick<CacheType, "ip" | "port">) => {
      let sseUrl: string;
      try {
        const backendUrl = `http://${cacheType.ip}:${cacheType.port}`;
        const u = new URL(backendUrl);
        const ip = u.hostname;
        const port = u.port || (u.protocol === "https:" ? "443" : "80");
        sseUrl = `/api/server/sse?type=${SseEventType.ZIP_PROGRESS}&ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`;
      } catch {
        sseUrl = `/api/server/sse?type=${SseEventType.ZIP_PROGRESS}`;
      }

      const es = new EventSource(sseUrl);
      sseMap.current.set(id, es);

      const handleRaw = (raw: string) => {
        try {
          const parsed = JSON.parse(raw) as unknown;
          let data: unknown = parsed;
          if (parsed && typeof parsed === "object" && "type" in parsed && "data" in parsed) {
            data = (parsed as { data: unknown }).data;
          }
          if (!isZipProgressPayload(data)) return;
          if (String(data.jobId) !== String(jobId)) return;
          applyProgress(id, jobId, data.progress, data.message, data.downloadUrl, cacheType);
        } catch { /* ignore */ }
      };

      es.onmessage = (e) => handleRaw(e.data);
      es.addEventListener(SseEventType.ZIP_PROGRESS, (e) => handleRaw((e as MessageEvent).data));
      es.addEventListener(SseEventType.ZIP_PROGRESS.toLowerCase(), (e) => handleRaw((e as MessageEvent).data));

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          sseMap.current.delete(id);
          startPollFallback(id, jobId, cacheType);
        }
      };
    },
    [applyProgress, startPollFallback],
  );

  const updateItem = React.useCallback(
    (id: string, patch: Partial<DownloadItem>) => {
      setDownloads((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    },
    [],
  );

  const runJob = React.useCallback(
    async (id: string, opts: StartZipExportOpts, cacheType: Pick<CacheType, "ip" | "port">) => {
      const range =
        opts.diffViewMode === "diff"
          ? diffCacheOrderedPair(opts.baseRev, opts.rev)
          : { base: opts.tableBase ?? 1, rev: opts.combinedRev };
      const rangeLabel =
        opts.diffViewMode === "diff"
          ? `Base ${range.base} \u2192 ${range.rev}`
          : `Rev ${range.rev} (base ${range.base})`;

      const url = zipCreateUrl({ type: opts.kind, base: range.base, rev: range.rev });
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: cacheProxyHeaders(cacheType),
          cache: "no-store",
        });
        const raw: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const err =
            raw && typeof raw === "object" && "error" in raw
              ? String((raw as { error?: unknown }).error ?? res.statusText)
              : res.statusText;
          throw new Error(err || `HTTP ${res.status}`);
        }

        const parsed = parseZipCreateResponse(raw);
        if (!parsed) throw new Error("Unexpected response from zip/create");

        if (parsed.status === "ready") {
          setDownloads((prev) => {
            const next = prev.map((d) =>
              d.id === id
                ? { ...d, jobId: parsed.jobId, phase: "done" as Phase, progress: 100, message: parsed.message ?? "Ready", downloadUrl: parsed.downloadUrl, rangeLabel }
                : d,
            );
            scheduleAutoClose(next);
            return next;
          });
          if (!didDownloadSet.current.has(id)) {
            didDownloadSet.current.add(id);
            triggerZipDownload(cacheType, parsed.downloadUrl, defaultZipFilename(parsed.jobId));
          }
          return;
        }

        updateItem(id, { jobId: parsed.jobId, phase: "building", message: "Connecting\u2026", rangeLabel });
        startSseForItem(id, parsed.jobId, cacheType);
      } catch (e) {
        setDownloads((prev) => {
          const next = prev.map((d) =>
            d.id === id
              ? { ...d, phase: "error" as Phase, errorText: e instanceof Error ? e.message : "Failed to create zip" }
              : d,
          );
          scheduleAutoClose(next);
          return next;
        });
      }
    },
    [scheduleAutoClose, startSseForItem, updateItem],
  );

  const startZipExport = React.useCallback(
    (opts: StartZipExportOpts) => {
      const id = `dl-${++downloadIdCounter}`;
      const cacheType = selectedCacheType;

      if (fadeTimerRef.current != null) {
        window.clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      setOpen(true);
      setIsFadingOut(false);

      const newItem: DownloadItem = {
        id,
        kind: opts.kind,
        jobId: null,
        phase: "creating",
        progress: 0,
        message: "Starting\u2026",
        downloadUrl: null,
        errorText: null,
        rangeLabel: "",
        expanded: true,
        opts,
      };
      setDownloads((prev) => [...prev, newItem]);
      void runJob(id, opts, cacheType);
    },
    [runJob, selectedCacheType],
  );

  const removeItem = React.useCallback(
    (id: string) => {
      cleanupItem(id);
      setDownloads((prev) => {
        const next = prev.filter((d) => d.id !== id);
        if (next.length === 0) { setOpen(false); setCollapsed(false); }
        return next;
      });
    },
    [cleanupItem],
  );

  const cancelItem = React.useCallback(
    (item: DownloadItem) => {
      cleanupItem(item.id);
      if (item.jobId) {
        void fetch(zipCancelUrl(item.jobId), {
          method: "DELETE",
          headers: cacheProxyHeaders(selectedCacheType),
        }).catch(() => {});
      }
      removeItem(item.id);
    },
    [cleanupItem, removeItem, selectedCacheType],
  );

  const retryItem = React.useCallback(
    (item: DownloadItem) => {
      cleanupItem(item.id);
      didDownloadSet.current.delete(item.id);
      updateItem(item.id, { phase: "creating", progress: 0, message: "Starting\u2026", downloadUrl: null, errorText: null, jobId: null });
      void runJob(item.id, item.opts, selectedCacheType);
    },
    [cleanupItem, runJob, selectedCacheType, updateItem],
  );

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, originLeft: pos.left, originTop: pos.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d?.active) return;
    const next = clampPos(d.originLeft + (e.clientX - d.startX), d.originTop + (e.clientY - d.startY));
    posDragRef.current = next;
    setPos(next);
  };

  const onHeaderPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.active) {
      dragRef.current.active = false;
      try {
        const p = posDragRef.current;
        sessionStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left: p.left, top: p.top }));
      } catch { /* ignore */ }
    }
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const panel =
    open && mounted ? (
      <div
        className={`pointer-events-auto fixed z-[500] flex flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl transition-opacity duration-300 ${isFadingOut ? "opacity-0" : "opacity-100"}`}
        style={{ left: pos.left, top: pos.top, width: "min(calc(100vw - 1rem), 20rem)" }}
        role="dialog"
        aria-label="Download manager"
      >
        {/* Panel header */}
        <div
          className="flex cursor-grab select-none items-center gap-2 border-b border-border bg-muted/40 px-2 py-2 active:cursor-grabbing"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            Downloads{downloads.length > 1 ? ` (${downloads.length})` : ""}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label={collapsed ? "Expand" : "Collapse"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
          >
            {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>

        {!collapsed && (
          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {downloads.map((item) => (
              <div key={item.id} className="space-y-2 p-3">
                {/* Item header row */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    onClick={() => updateItem(item.id, { expanded: !item.expanded })}
                  >
                    {item.phase === "creating" || item.phase === "building" ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                    ) : item.expanded ? (
                      <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="truncate text-sm font-medium">
                      {item.kind === "sprites" ? "Sprites" : "Textures"} ZIP
                    </span>
                    {item.rangeLabel ? (
                      <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {item.rangeLabel}
                      </span>
                    ) : null}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                    onClick={() => (item.phase === "building" ? cancelItem(item) : removeItem(item.id))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>

                {/* Item body */}
                {item.expanded ? (
                  <div className="space-y-1.5 pl-5">
                    {item.phase === "error" && item.errorText ? (
                      <>
                        <p className="text-sm text-destructive">{item.errorText}</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => retryItem(item)}>
                          Retry
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary transition-[width] duration-300 ease-out"
                            style={{ width: `${Math.round(item.progress)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
                          <span className="truncate pr-2">{item.message || "\u2014"}</span>
                          <span className="shrink-0">{Math.round(item.progress)}%</span>
                        </div>
                        {item.phase === "done" ? (
                          <div className="flex items-center gap-1.5">
                            <Download className="size-3.5 shrink-0 text-green-600 dark:text-green-500" aria-hidden />
                            <span className="text-xs text-green-600 dark:text-green-500">Download started</span>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="ml-auto h-6 text-xs text-muted-foreground"
                              onClick={() =>
                                triggerZipDownload(selectedCacheType, item.downloadUrl!, defaultZipFilename(item.jobId!))
                              }
                            >
                              Again
                            </Button>
                          </div>
                        ) : null}
                        {item.phase === "building" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => cancelItem(item)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    ) : null;

  const value = React.useMemo(() => ({ startZipExport }), [startZipExport]);

  return (
    <ZipDownloadContext.Provider value={value}>
      {children}
      {mounted && panel ? createPortal(panel, document.body) : null}
    </ZipDownloadContext.Provider>
  );
}
