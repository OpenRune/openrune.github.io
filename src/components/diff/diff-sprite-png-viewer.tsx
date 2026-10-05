"use client";

import * as React from "react";
import {
  IconArrowsHorizontal,
  IconExternalLink,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { useCacheType } from "@/context/cache-type-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { diffCacheOrderedPair, diffSpriteImageUrl } from "@/lib/cache-api-client";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { InspectorChangeKind } from "./diff-inspector-panel";
import {
  parseSpriteViewerUrlState,
  writeSpriteViewerParams,
} from "./diff-sprite-viewer-url";

type DiffSpritePngViewerProps = {
  spriteId: number;
  kind: InspectorChangeKind;
  diffViewMode: "combined" | "diff";
  combinedRev: number;
  baseRev: number;
  rev: number;
  onBack?: () => void;
  /** When false, hide the back/close control (e.g. dialog already has X). Default true. */
  showBack?: boolean;
  backLabel?: string;
  className?: string;
};

type CompareMode = "swipe" | "overlay" | "side";
type ZoomMode = "fit" | "pixel" | "manual";

const CHECKERBOARD_STYLE: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  backgroundImage:
    "linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16];

function nearestZoomStep(scale: number, direction: 1 | -1): number {
  if (direction > 0) {
    return ZOOM_STEPS.find((s) => s > scale + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]!;
  }
  const descending = [...ZOOM_STEPS].reverse();
  return descending.find((s) => s < scale - 0.001) ?? ZOOM_STEPS[0]!;
}

/** Prefer 400% for typical RS sprites; step down for larger images. */
function preferredSpriteZoom(w: number, h: number): number {
  const max = Math.max(w, h);
  if (max <= 48) return 4; // 400%
  if (max <= 96) return 2; // 200%
  return 1; // 100%
}

function clampZoomToFit(preferred: number, fitScale: number): number {
  if (!(fitScale > 0) || preferred <= fitScale + 0.001) return preferred;
  const descending = [...ZOOM_STEPS].reverse();
  return descending.find((s) => s <= fitScale + 0.001) ?? Math.max(0.25, fitScale);
}

function openUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function LabelBadge({
  eyebrow,
  title,
  detail,
  align = "left",
  tone = "neutral",
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  align?: "left" | "right";
  tone?: "before" | "after" | "neutral";
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-3 z-20 min-w-[7.5rem] rounded-md border px-2.5 py-1.5 shadow-sm backdrop-blur-sm",
        align === "left" ? "left-3 text-left" : "right-3 text-right",
        tone === "before" && "border-amber-500/40 bg-black/75",
        tone === "after" && "border-sky-500/40 bg-black/75",
        tone === "neutral" && "border-white/10 bg-black/70",
      )}
    >
      <div
        className={cn(
          "text-[10px] font-semibold tracking-wide uppercase",
          tone === "before" && "text-amber-300",
          tone === "after" && "text-sky-300",
          tone === "neutral" && "text-white/70",
        )}
      >
        {eyebrow}
      </div>
      <div className="text-[12px] font-semibold text-white">{title}</div>
      {detail ? <div className="font-mono text-[10px] text-white/65">{detail}</div> : null}
    </div>
  );
}

function ToolbarChip({
  active,
  disabled,
  onClick,
  children,
  className,
  ...props
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors",
        active
          ? "bg-sky-600 text-white"
          : "bg-transparent text-foreground/80 hover:bg-muted hover:text-foreground",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function PixelImage({
  src,
  alt,
  scale,
  naturalSize,
  onNaturalSize,
  className,
  style,
}: {
  src: string;
  alt: string;
  scale: number;
  naturalSize: { w: number; h: number } | null;
  onNaturalSize?: (size: { w: number; h: number }) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const w = naturalSize ? Math.max(1, Math.round(naturalSize.w * scale)) : undefined;
  const h = naturalSize ? Math.max(1, Math.round(naturalSize.h * scale)) : undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={w}
      height={h}
      className={cn("max-w-none select-none", className)}
      style={{
        imageRendering: "pixelated",
        width: w,
        height: h,
        ...style,
      }}
      draggable={false}
      decoding="async"
      onLoad={(e) => {
        const img = e.currentTarget;
        onNaturalSize?.({ w: img.naturalWidth, h: img.naturalHeight });
      }}
    />
  );
}

export function DiffSpritePngViewer({
  spriteId,
  kind,
  diffViewMode,
  combinedRev,
  baseRev,
  rev,
  onBack,
  showBack = true,
  backLabel = "Back to sprites",
  className,
}: DiffSpritePngViewerProps) {
  const { selectedCacheType } = useCacheType();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pair = React.useMemo(() => diffCacheOrderedPair(baseRev, rev), [baseRev, rev]);
  const older = pair.base;
  const newer = pair.rev;

  const beforeSrc =
    diffViewMode === "diff" && kind !== "added"
      ? diffSpriteImageUrl(selectedCacheType, spriteId, { ...pair, source: older })
      : null;
  const afterSrc =
    diffViewMode === "combined"
      ? diffSpriteImageUrl(selectedCacheType, spriteId, {
          base: 1,
          rev: combinedRev,
          source: combinedRev,
        })
      : kind === "removed"
        ? null
        : diffSpriteImageUrl(selectedCacheType, spriteId, { ...pair, source: newer });

  const canCompare = Boolean(beforeSrc && afterSrc);
  const kindLabel = kind === "added" ? "Added" : kind === "removed" ? "Removed" : "Changed";

  const urlBoot = React.useMemo(() => {
    const parsed = parseSpriteViewerUrlState(searchParams);
    if (parsed.spriteId != null && parsed.spriteId !== spriteId) {
      return null;
    }
    return parsed;
    // Only bootstrap from the URL for the initially opened sprite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spriteId]);

  const [mode, setMode] = React.useState<CompareMode>(
    () => urlBoot?.mode ?? (canCompare ? "swipe" : "side"),
  );
  const [zoomMode, setZoomMode] = React.useState<ZoomMode>(() => urlBoot?.zoomMode ?? "manual");
  const [manualScale, setManualScale] = React.useState(() => urlBoot?.manualScale ?? 4);
  const [fitScale, setFitScale] = React.useState(1);
  const [naturalSize, setNaturalSize] = React.useState<{ w: number; h: number } | null>(null);
  const [swipePct, setSwipePct] = React.useState(() => urlBoot?.swipePct ?? 50);
  const [overlayOpacity, setOverlayOpacity] = React.useState(() => urlBoot?.overlayOpacity ?? 0.5);
  const [dragging, setDragging] = React.useState(false);

  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const swipeRef = React.useRef<HTMLDivElement | null>(null);
  const userAdjustedZoomRef = React.useRef(Boolean(urlBoot?.zoomMode));
  const skipUrlWriteRef = React.useRef(true);
  const spriteKey = `${spriteId}:${beforeSrc ?? ""}:${afterSrc ?? ""}`;
  const debouncedSwipePct = useDebouncedValue(swipePct, 120);
  const debouncedOverlayOpacity = useDebouncedValue(overlayOpacity, 120);

  React.useEffect(() => {
    setNaturalSize(null);
    const parsed = parseSpriteViewerUrlState(searchParams);
    if (parsed.spriteId === spriteId) {
      if (parsed.mode) setMode(parsed.mode);
      else setMode(canCompare ? "swipe" : "side");
      if (parsed.zoomMode) {
        setZoomMode(parsed.zoomMode);
        if (parsed.manualScale != null) setManualScale(parsed.manualScale);
        userAdjustedZoomRef.current = true;
      } else {
        setZoomMode("manual");
        setManualScale(4);
        userAdjustedZoomRef.current = false;
      }
      if (parsed.swipePct != null) setSwipePct(parsed.swipePct);
      else setSwipePct(50);
      if (parsed.overlayOpacity != null) setOverlayOpacity(parsed.overlayOpacity);
      else setOverlayOpacity(0.5);
    } else {
      setZoomMode("manual");
      setManualScale(4);
      setSwipePct(50);
      setOverlayOpacity(0.5);
      setMode(canCompare ? "swipe" : "side");
      userAdjustedZoomRef.current = false;
    }
    skipUrlWriteRef.current = true;
    // Intentionally keyed by sprite identity; URL is read at switch time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spriteKey]);

  React.useEffect(() => {
    if (!canCompare && mode !== "side") setMode("side");
  }, [canCompare, mode]);

  const measureFit = React.useCallback(() => {
    const el = stageRef.current;
    if (!el || !naturalSize) return;
    const pad = 32;
    const aw = Math.max(1, el.clientWidth - pad);
    const ah = Math.max(1, el.clientHeight - pad);
    const sx = aw / naturalSize.w;
    const sy = ah / naturalSize.h;
    // Side-by-side needs half width when both present.
    const sideFactor = mode === "side" && canCompare ? 0.48 : 1;
    setFitScale(Math.max(0.05, Math.min(sx * sideFactor, sy, 16)));
  }, [canCompare, mode, naturalSize]);

  React.useEffect(() => {
    measureFit();
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureFit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureFit]);

  React.useEffect(() => {
    if (!naturalSize || userAdjustedZoomRef.current) return;
    const preferred = preferredSpriteZoom(naturalSize.w, naturalSize.h);
    const next = clampZoomToFit(preferred, fitScale);
    setZoomMode("manual");
    setManualScale(next);
  }, [fitScale, naturalSize]);

  React.useEffect(() => {
    if (skipUrlWriteRef.current) {
      skipUrlWriteRef.current = false;
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    writeSpriteViewerParams(params, {
      spriteId,
      kind,
      mode,
      zoomMode,
      manualScale: zoomMode === "pixel" ? 1 : manualScale,
      swipePct: debouncedSwipePct,
      overlayOpacity: debouncedOverlayOpacity,
    });
    const qs = params.toString();
    if (qs === searchParams.toString()) return;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    debouncedOverlayOpacity,
    debouncedSwipePct,
    kind,
    manualScale,
    mode,
    pathname,
    router,
    searchParams,
    spriteId,
    zoomMode,
  ]);

  const scale = zoomMode === "fit" ? fitScale : zoomMode === "pixel" ? 1 : manualScale;
  const zoomLabel =
    zoomMode === "fit" ? "Fit" : zoomMode === "pixel" ? "1:1" : `${Math.round(scale * 100)}%`;

  const bumpZoom = (direction: 1 | -1) => {
    userAdjustedZoomRef.current = true;
    const next = nearestZoomStep(scale, direction);
    setZoomMode("manual");
    setManualScale(next);
  };

  const setZoomPreset = (next: ZoomMode, manual = 1) => {
    userAdjustedZoomRef.current = true;
    setZoomMode(next);
    if (next === "manual" || next === "pixel") setManualScale(manual);
  };

  const updateSwipeFromClientX = React.useCallback((clientX: number) => {
    const el = swipeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSwipePct(Math.min(100, Math.max(0, pct)));
  }, []);

  const onSwipePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      updateSwipeFromClientX(e.clientX);
    },
    [updateSwipeFromClientX],
  );

  const onSwipePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      updateSwipeFromClientX(e.clientX);
    },
    [updateSwipeFromClientX],
  );

  const onSwipePointerUp = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  }, []);

  const beforeEyebrow = "Before · left";
  const afterEyebrow =
    kind === "added" ? "Added · right" : kind === "removed" ? "Removed · right" : "After · right";
  const beforeTitle = diffViewMode === "combined" ? `Cache ${combinedRev}` : `Base rev ${older}`;
  const afterTitle =
    diffViewMode === "combined"
      ? `Cache ${combinedRev}`
      : kind === "removed"
        ? `Gone in rev ${newer}`
        : `Compare rev ${newer}`;
  const beforeDetail = diffViewMode === "diff" ? `${older}` : undefined;
  const afterDetail = diffViewMode === "diff" ? `${newer}` : undefined;

  const scaledW = naturalSize ? Math.max(1, Math.round(naturalSize.w * scale)) : undefined;
  const scaledH = naturalSize ? Math.max(1, Math.round(naturalSize.h * scale)) : undefined;

  const renderScaledImage = (src: string, alt: string) => (
    <PixelImage
      src={src}
      alt={alt}
      scale={scale}
      naturalSize={naturalSize}
      onNaturalSize={(size) =>
        setNaturalSize((prev) => (prev && prev.w === size.w && prev.h === size.h ? prev : size))
      }
    />
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-hidden", className)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Sprite {spriteId}</div>
          <div className="text-[11px] text-muted-foreground">
            {diffViewMode === "combined" ? (
              <>Cache {combinedRev}</>
            ) : (
              <>
                {kindLabel} · {older} → {newer}
              </>
            )}
          </div>
        </div>
        {showBack && onBack ? (
          <Button type="button" size="sm" variant="outline" onClick={onBack}>
            {backLabel}
          </Button>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-1 rounded-lg border bg-muted/30 p-1">
        <div className="flex items-center gap-0.5 rounded-md bg-background/60 p-0.5">
          <ToolbarChip active={mode === "swipe"} disabled={!canCompare} onClick={() => setMode("swipe")}>
            Swipe
          </ToolbarChip>
          <ToolbarChip
            active={mode === "overlay"}
            disabled={!canCompare}
            onClick={() => setMode("overlay")}
          >
            Overlay
          </ToolbarChip>
          <ToolbarChip active={mode === "side" || !canCompare} onClick={() => setMode("side")}>
            Side by side
          </ToolbarChip>
        </div>

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />

        <div className="flex items-center gap-0.5 rounded-md bg-background/60 p-0.5">
          <ToolbarChip active={zoomMode === "fit"} onClick={() => setZoomPreset("fit")}>
            Fit
          </ToolbarChip>
          <ToolbarChip onClick={() => bumpZoom(-1)} aria-label="Zoom out">
            <IconMinus className="size-3.5" />
          </ToolbarChip>
          <span className="min-w-10 px-1 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
            {zoomLabel}
          </span>
          <ToolbarChip onClick={() => bumpZoom(1)} aria-label="Zoom in">
            <IconPlus className="size-3.5" />
          </ToolbarChip>
          <ToolbarChip active={zoomMode === "pixel"} onClick={() => setZoomPreset("pixel", 1)}>
            1:1
          </ToolbarChip>
        </div>

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />

        <div className="flex items-center gap-0.5 rounded-md bg-background/60 p-0.5">
          <ToolbarChip disabled={!beforeSrc} onClick={() => beforeSrc && openUrl(beforeSrc)}>
            Base {diffViewMode === "diff" ? older : combinedRev}
            <IconExternalLink className="size-3.5 opacity-70" />
          </ToolbarChip>
          <ToolbarChip disabled={!afterSrc} onClick={() => afterSrc && openUrl(afterSrc)}>
            Compare {diffViewMode === "diff" ? newer : combinedRev}
            <IconExternalLink className="size-3.5 opacity-70" />
          </ToolbarChip>
        </div>

        {mode === "overlay" && canCompare ? (
          <>
            <div className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
            <label className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
              Opacity
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(overlayOpacity * 100)}
                onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                className="h-1.5 w-24 cursor-pointer accent-sky-600"
              />
            </label>
          </>
        ) : null}
      </div>

      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-auto rounded-lg border"
        style={CHECKERBOARD_STYLE}
      >
        {!beforeSrc && !afterSrc ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        ) : mode === "side" || !canCompare ? (
          <div
            className={cn(
              "flex h-full min-h-[12rem] items-stretch justify-center gap-0",
              canCompare ? "flex-col md:flex-row" : "flex-col",
            )}
          >
            {beforeSrc ? (
              <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                <LabelBadge
                  eyebrow={beforeEyebrow}
                  title={beforeTitle}
                  detail={beforeDetail}
                  tone="before"
                />
                {renderScaledImage(beforeSrc, `Sprite ${spriteId} before`)}
              </div>
            ) : null}
            {canCompare ? <div className="hidden w-px shrink-0 bg-white/20 md:block" aria-hidden /> : null}
            {afterSrc ? (
              <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                <LabelBadge
                  eyebrow={afterEyebrow}
                  title={afterTitle}
                  detail={afterDetail}
                  align={canCompare ? "right" : "left"}
                  tone="after"
                />
                {renderScaledImage(afterSrc, `Sprite ${spriteId} after`)}
              </div>
            ) : kind === "removed" ? (
              <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
                <LabelBadge
                  eyebrow={afterEyebrow}
                  title={afterTitle}
                  detail={afterDetail}
                  align="right"
                  tone="after"
                />
                Removed in this revision
              </div>
            ) : null}
          </div>
        ) : mode === "overlay" ? (
          <div className="relative flex h-full min-h-[12rem] items-center justify-center overflow-auto p-4">
            <LabelBadge
              eyebrow={beforeEyebrow}
              title={beforeTitle}
              detail={beforeDetail}
              tone="before"
            />
            <LabelBadge
              eyebrow={afterEyebrow}
              title={afterTitle}
              detail={afterDetail}
              align="right"
              tone="after"
            />
            <div className="relative inline-block">
              {beforeSrc ? renderScaledImage(beforeSrc, `Sprite ${spriteId} before`) : null}
              {afterSrc ? (
                <div className="absolute inset-0" style={{ opacity: overlayOpacity }}>
                  {renderScaledImage(afterSrc, `Sprite ${spriteId} after`)}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="relative flex h-full min-h-[12rem] items-center justify-center overflow-auto p-4">
            <LabelBadge
              eyebrow={beforeEyebrow}
              title={beforeTitle}
              detail={beforeDetail}
              tone="before"
            />
            <LabelBadge
              eyebrow={afterEyebrow}
              title={afterTitle}
              detail={afterDetail}
              align="right"
              tone="after"
            />

            <div
              ref={swipeRef}
              role="slider"
              aria-label="Compare swipe"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(swipePct)}
              aria-valuetext={`${Math.round(swipePct)}% before (rev ${older})`}
              tabIndex={0}
              className={cn(
                "relative touch-none select-none",
                dragging ? "cursor-grabbing" : "cursor-ew-resize",
              )}
              style={{
                width: scaledW,
                height: scaledH,
                minWidth: scaledW ?? 64,
                minHeight: scaledH ?? 64,
              }}
              onPointerDown={onSwipePointerDown}
              onPointerMove={onSwipePointerMove}
              onPointerUp={onSwipePointerUp}
              onPointerCancel={onSwipePointerUp}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setSwipePct((p) => Math.max(0, p - 2));
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setSwipePct((p) => Math.min(100, p + 2));
                }
              }}
            >
              {afterSrc ? (
                <div className="absolute inset-0">
                  {renderScaledImage(afterSrc, `Sprite ${spriteId} after`)}
                </div>
              ) : null}
              {beforeSrc ? (
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - swipePct}% 0 0)` }}
                >
                  {renderScaledImage(beforeSrc, `Sprite ${spriteId} before`)}
                </div>
              ) : null}

              <div
                className="pointer-events-none absolute top-0 bottom-0 z-10"
                style={{ left: `${swipePct}%`, transform: "translateX(-50%)" }}
              >
                <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" />
                <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border border-white/90 bg-black/80 text-white shadow-md",
                      dragging && "scale-110",
                    )}
                  >
                    <IconArrowsHorizontal className="size-4" />
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-black/75 px-1.5 py-0.5 font-mono text-[9px] text-white/90">
                    <span className="text-amber-300">{older}</span>
                    <span className="text-white/40">|</span>
                    <span className="text-sky-300">{newer}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
