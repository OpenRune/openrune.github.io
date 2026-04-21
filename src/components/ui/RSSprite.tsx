"use client";

import * as React from "react";
import { IconLoader2 } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GAMEVAL_MIN_REVISION } from "@/components/diff/diff-constants";
import { useCacheType } from "@/context/cache-type-context";
import { SPRITETYPES, useGamevals } from "@/context/gameval-context";
import { cacheProxyHeaders, spritesProxyUrl } from "@/lib/cache-proxy-client";
import { conditionalBlobFetch } from "@/lib/openrune-idb-cache";
import { RspLoadingSlot } from "@/components/ui/rsp-loading-slot";
import { cn } from "@/lib/utils";

export type ExtraTab = {
  value: string;
  label: string;
  content: React.ReactNode;
};

type RSSpriteProps = {
  id: string | number;
  width?: number;
  height?: number;
  rounded?: boolean;
  thumbnail?: boolean;
  enableClickModel?: boolean;
  /** Shown in alt text; modal title uses `gamevalRevision` lookup when valid. */
  gameval?: string;
  className?: string;
  keepAspectRatio?: boolean;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
  saveSprite?: boolean;
  extraData?: { count?: number };
  modalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
  textureId?: number;
  extraTabs?: ExtraTab[];
  modalTitle?: string;
  /** When set, use this URL for the thumbnail (e.g. diff combined sprite URL). */
  imageUrl?: string;
  /** Full-size / modal image URL (defaults to `imageUrl`). */
  fullSizeImageUrl?: string;
  /** Revision for cache `sprites` API when not using `imageUrl`. */
  rev?: number;
  /** Base revision for cache `sprites` API when not using `imageUrl`. */
  base?: number;
  /** Revision used to resolve sprite gameval name in the modal title (e.g. diff combined rev). Defaults to `rev`. */
  gamevalRevision?: number;
  /**
   * When true, `width` / `height` are a maximum box: the image keeps intrinsic pixel size until it exceeds
   * the box, then scales down with `object-contain`. When false, the image is forced to `width`×`height` px.
   */
  fitMax?: boolean;
  /** Stretch thumb / loading shimmer to fill a `relative` parent (e.g. combined sprite grid cell). */
  fillCell?: boolean;
};

/** Subsprites path only; thumbnails use `URL.createObjectURL` (no base64 / FileReader). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read sprite"));
    reader.readAsDataURL(blob);
  });
}

export function RSSprite({
  id,
  width = 32,
  height = 32,
  rounded = false,
  thumbnail = false,
  enableClickModel = false,
  gameval,
  className = "",
  keepAspectRatio = false,
  onClick,
  saveSprite = false,
  extraData,
  modalOpen: externalModalOpen,
  onModalOpenChange: externalOnModalOpenChange,
  textureId,
  extraTabs = [],
  modalTitle,
  imageUrl: imageUrlOverride,
  fullSizeImageUrl: fullSizeImageUrlOverride,
  rev,
  base,
  gamevalRevision,
  fitMax = false,
  fillCell = false,
}: RSSpriteProps) {
  const { selectedCacheType } = useCacheType();
  const { lookupGameval, hasLoaded, loadGamevalType } = useGamevals();
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  /** Thumbnail is always loaded via fetch + IndexedDB (override or sprites API). */
  const [loading, setLoading] = React.useState(true);
  const [urlLoaded, setUrlLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const [internalModalOpen, setInternalModalOpen] = React.useState(false);
  const [subsprites, setSubsprites] = React.useState<{ index: number; imageUrl: string }[]>([]);
  const [loadingSubsprites, setLoadingSubsprites] = React.useState(false);
  const [subspritesError, setSubspritesError] = React.useState<string | null>(null);
  const [decodeError, setDecodeError] = React.useState(false);
  const thumbImgRef = React.useRef<HTMLImageElement | null>(null);
  const thumbBlobUrlRef = React.useRef<string | null>(null);

  const revokeThumbBlobUrl = React.useCallback(() => {
    if (thumbBlobUrlRef.current) {
      URL.revokeObjectURL(thumbBlobUrlRef.current);
      thumbBlobUrlRef.current = null;
    }
  }, []);

  const modalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;
  const setModalOpen = externalOnModalOpenChange ?? setInternalModalOpen;

  const revForGameval = gamevalRevision ?? rev;
  const gamevalTitleEnabled =
    typeof revForGameval === "number" &&
    Number.isFinite(revForGameval) &&
    revForGameval >= GAMEVAL_MIN_REVISION;

  const spriteGamevalLoaded =
    typeof revForGameval === "number" ? hasLoaded(SPRITETYPES, revForGameval) : false;

  const titleGameval = React.useMemo(() => {
    if (!gamevalTitleEnabled || typeof revForGameval !== "number") return undefined;
    return gameval ?? lookupGameval(SPRITETYPES, Number(id), revForGameval);
  }, [gamevalTitleEnabled, revForGameval, lookupGameval, id, gameval, spriteGamevalLoaded]);

  React.useEffect(() => {
    if (!modalOpen || !gamevalTitleEnabled || typeof revForGameval !== "number") return;
    void loadGamevalType(SPRITETYPES, revForGameval);
  }, [modalOpen, gamevalTitleEnabled, revForGameval, loadGamevalType]);

  const maxRetries = 3;
  const retryDelay = 2000;

  const fullSizeSpriteUrl = React.useMemo(() => {
    if (fullSizeImageUrlOverride) return fullSizeImageUrlOverride;
    return spritesProxyUrl({ id, base, rev });
  }, [id, rev, base, fullSizeImageUrlOverride]);

  /** When thumb URL === modal URL (diff sprites), reuse fetched data URL so the modal does not refetch. */
  const modalImageSrc = React.useMemo(() => {
    if (
      imageUrlOverride &&
      fullSizeImageUrlOverride &&
      imageUrlOverride === fullSizeImageUrlOverride &&
      imageSrc
    ) {
      return imageSrc;
    }
    return fullSizeSpriteUrl;
  }, [imageUrlOverride, fullSizeImageUrlOverride, imageSrc, fullSizeSpriteUrl]);

  const fetchSubsprites = React.useCallback(async () => {
    if (loadingSubsprites || subsprites.length > 0) return;

    setLoadingSubsprites(true);
    setSubspritesError(null);

    try {
      const spriteCount = extraData?.count ?? 0;
      if (spriteCount > 1) {
        const headers = cacheProxyHeaders(selectedCacheType);
        const results = await Promise.all(
          Array.from({ length: spriteCount }, (_, index) =>
            fetch(spritesProxyUrl({ id, indexed: index, width: 128, height: 128, keepAspectRatio: true }), {
              headers,
              cache: "no-store",
            })
              .then(async (response) => {
                if (!response.ok) return null;
                const blob = await response.blob();
                const imageUrl = await blobToDataUrl(blob);
                return { index, imageUrl };
              })
              .catch(() => null),
          ),
        );
        const valid = results.filter((r): r is { index: number; imageUrl: string } => r !== null);
        setSubsprites(valid.sort((a, b) => a.index - b.index));
      }
    } catch (err) {
      setSubspritesError(err instanceof Error ? err.message : "Failed to load subsprites");
    } finally {
      setLoadingSubsprites(false);
    }
  }, [id, extraData?.count, loadingSubsprites, subsprites.length, selectedCacheType.id, selectedCacheType.ip, selectedCacheType.port]);

  /** Diff / explicit `imageUrl` — same conditional + IndexedDB path as `sprites` API. */
  React.useEffect(() => {
    if (!imageUrlOverride) return;

    const cacheTypeId = selectedCacheType?.id ?? "default";
    const cacheKey = `sprite:diff:png:${cacheTypeId}:${imageUrlOverride}`;

    let cancelled = false;
    setLoading(true);
    setDecodeError(false);
    setError(null);
    revokeThumbBlobUrl();
    setImageSrc(null);
    setUrlLoaded(false);

    const init = { headers: cacheProxyHeaders(selectedCacheType) };
    void conditionalBlobFetch(cacheKey, imageUrlOverride, init, {
      onBackgroundBlob: (nb) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(nb);
        revokeThumbBlobUrl();
        thumbBlobUrlRef.current = objectUrl;
        setImageSrc(objectUrl);
        setUrlLoaded(false);
      },
    })
      .then(({ blob }) => {
        const objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        revokeThumbBlobUrl();
        thumbBlobUrlRef.current = objectUrl;
        setImageSrc(objectUrl);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load sprite");
        if (retryCount < maxRetries) {
          window.setTimeout(() => setRetryCount((p) => p + 1), retryDelay);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      revokeThumbBlobUrl();
    };
  }, [
    imageUrlOverride,
    retryCount,
    revokeThumbBlobUrl,
    selectedCacheType.id,
    selectedCacheType.ip,
    selectedCacheType.port,
  ]);

  /** Cached images often skip `load`; without this, `urlLoaded` stays false and the thumb stays `opacity-0`. */
  React.useLayoutEffect(() => {
    if (!imageSrc) return;
    const el = thumbImgRef.current;
    if (el?.complete && el.naturalWidth > 0) {
      setUrlLoaded(true);
    }
  }, [imageSrc]);

  React.useEffect(() => {
    if (imageUrlOverride) return;

    const cacheTypeId = selectedCacheType?.id ?? "default";
    const cacheKey = `sprite:png:${cacheTypeId}_${id}_${width}_${height}_${keepAspectRatio}_${base ?? ""}_${rev ?? ""}`;

    let cancelled = false;
    setLoading(true);
    setDecodeError(false);
    setError(null);

    const url = spritesProxyUrl({ id, width, height, keepAspectRatio, base, rev });
    const init = { headers: cacheProxyHeaders(selectedCacheType) };
    void conditionalBlobFetch(cacheKey, url, init, {
      onBackgroundBlob: (nb) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(nb);
        revokeThumbBlobUrl();
        thumbBlobUrlRef.current = objectUrl;
        setImageSrc(objectUrl);
        setUrlLoaded(false);
      },
    })
      .then(({ blob }) => {
        const objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        revokeThumbBlobUrl();
        thumbBlobUrlRef.current = objectUrl;
        setImageSrc(objectUrl);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load sprite");
        if (retryCount < maxRetries) {
          window.setTimeout(() => setRetryCount((p) => p + 1), retryDelay);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      revokeThumbBlobUrl();
    };
  }, [
    id,
    width,
    height,
    keepAspectRatio,
    retryCount,
    revokeThumbBlobUrl,
    selectedCacheType.id,
    selectedCacheType.ip,
    selectedCacheType.port,
    imageUrlOverride,
    base,
    rev,
  ]);

  React.useEffect(() => {
    if (
      modalOpen &&
      enableClickModel &&
      !loadingSubsprites &&
      subsprites.length === 0 &&
      extraData?.count &&
      extraData.count > 1
    ) {
      void fetchSubsprites();
    }
  }, [modalOpen, enableClickModel, extraData?.count, fetchSubsprites, loadingSubsprites, subsprites.length]);

  const copyImageUrl = async () => {
    try {
      const urlToCopy =
        typeof window !== "undefined" && fullSizeSpriteUrl.startsWith("/")
          ? `${window.location.origin}${fullSizeSpriteUrl}`
          : fullSizeSpriteUrl;
      await navigator.clipboard.writeText(urlToCopy);
    } catch {
      // Ignore clipboard failures.
    }
  };

  const downloadImage = () => {
    const url = fullSizeSpriteUrl;
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `sprite-${id}.png`;
    link.click();
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (enableClickModel) setModalOpen(true);
    onClick?.(e);
  };

  const hasSubsprites = subsprites.length > 0 || (extraData?.count && extraData.count > 1);
  const tabCount = (hasSubsprites ? 1 : 0) + extraTabs.length + 1;

  const altLabel = titleGameval ?? gameval;

  /** Fills parent cell; never max-clamp so thumb matches the slot, not the fetch width/height. */
  const cellFillStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    minWidth: 0,
    minHeight: 0,
  };

  const boxStyle: React.CSSProperties = fillCell
    ? cellFillStyle
    : fitMax
      ? { maxWidth: width, maxHeight: height }
      : { width, height };

  const thumbWrapperClass = cn(
    "relative overflow-hidden",
    fillCell && "flex size-full min-h-0 min-w-0 items-center justify-center",
    !fillCell &&
      fitMax &&
      "inline-flex min-h-0 min-w-0 items-center justify-center",
    !fillCell && !fitMax && "inline-block",
    rounded && "rounded-md",
    !enableClickModel && className,
  );

  const thumbShellClass = cn(
    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
    enableClickModel && "cursor-pointer transition-opacity hover:opacity-90",
    fillCell ? "relative flex h-full min-h-0 w-full flex-col" : "inline-flex flex-col items-center",
    thumbnail && enableClickModel && "rounded-md border border-primary shadow-sm",
  );

  const onThumbShellKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!enableClickModel) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setModalOpen(true);
    }
  };

  const onThumbShellClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enableClickModel) return;
    setModalOpen(true);
    if (onClick) onClick(e as unknown as React.MouseEvent<HTMLImageElement>);
  };

  const loadingSlot = (
    <RspLoadingSlot
      className={cn(fillCell && "min-h-0 flex-1", !enableClickModel && className)}
      style={fillCell ? cellFillStyle : boxStyle}
      rounded={rounded}
      ariaLabel="Loading sprite"
    />
  );

  const spriteModalElement = enableClickModel ? (
    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-3xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {modalTitle ??
              (textureId !== undefined ? (
                <>{titleGameval ? titleGameval : `Texture ${textureId}`}</>
              ) : (
                <>{titleGameval ? `sprites.${titleGameval}` : `Sprite [${id}]`}</>
              ))}
          </DialogTitle>
          <DialogDescription>
            {textureId !== undefined ? `texture · ID ${textureId}` : `sprites · ID ${id}`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 text-sm">
          <Tabs defaultValue="sprite">
            <TabsList
              className={cn(
                "mb-3 w-full",
                tabCount === 1 && "grid-cols-1",
                tabCount === 2 && "grid-cols-2",
                tabCount === 3 && "grid-cols-3",
                tabCount === 4 && "grid-cols-4",
                tabCount >= 5 && "grid-cols-5",
                "grid",
              )}
            >
              <TabsTrigger value="sprite" className="flex-1">
                Sprite
              </TabsTrigger>
              {hasSubsprites ? (
                <TabsTrigger value="subsprites" className="flex-1">
                  Subsprites
                </TabsTrigger>
              ) : null}
              {extraTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="flex-1">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="sprite" className="mt-0">
              <div className="flex flex-col items-center gap-4 rounded-md border border-border/60 bg-background/90 p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={modalImageSrc}
                  alt={`Sprite ${id}`}
                  className="max-h-[50vh] max-w-full object-contain"
                  draggable={false}
                  decoding="async"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="flex shrink-0 justify-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyImageUrl()}>
                    Copy URL
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={downloadImage}>
                    Download
                  </Button>
                </div>
              </div>
            </TabsContent>

            {hasSubsprites || (extraData?.count && extraData.count > 1) ? (
              <TabsContent value="subsprites" className="mt-0">
                <div className="rounded-md border border-border/60 bg-background/90">
                  <div className="max-h-[50vh] overflow-auto">
                    {loadingSubsprites ? (
                      <div className="flex items-center justify-center py-8">
                        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : subspritesError ? (
                      <div className="py-8 text-center text-sm text-destructive">{subspritesError}</div>
                    ) : subsprites.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">No subsprites available</div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4">
                        {subsprites.map((sub) => {
                          const url = spritesProxyUrl({
                            id,
                            indexed: sub.index,
                            width: 128,
                            height: 128,
                            keepAspectRatio: true,
                            base,
                            rev,
                          });
                          return (
                            <div key={sub.index} className="flex flex-col items-center gap-2">
                              <div className="text-sm font-medium">Index {sub.index}</div>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={sub.imageUrl || url}
                                alt={`Subsprite ${sub.index}`}
                                className="max-h-32 max-w-full rounded border object-contain"
                                draggable={false}
                                decoding="async"
                                loading="lazy"
                                style={{ imageRendering: "pixelated" }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            ) : null}

            {extraTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                <div className="rounded-md border border-border/60 bg-background/90 p-4">{tab.content}</div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  ) : null;

  const thumbInner = (
    <div className={thumbWrapperClass} style={boxStyle}>
      {imageSrc && !urlLoaded ? (
        <div className="absolute inset-0 z-[1] overflow-hidden rounded-[inherit]" aria-hidden>
          <RspLoadingSlot className="h-full w-full rounded-[inherit]" decorative rounded={false} />
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={thumbImgRef}
        key={typeof imageUrlOverride === "string" ? imageUrlOverride : `sprite-${id}`}
        src={imageSrc ?? undefined}
        alt={altLabel ? String(altLabel) : `Sprite ${id}`}
        onClick={enableClickModel ? undefined : handleImageClick}
        draggable={false}
        decoding="async"
        loading="lazy"
        className={cn(
          rounded && "rounded-md",
          thumbnail && !enableClickModel && "border border-primary shadow-sm",
          enableClickModel && "pointer-events-none",
          !enableClickModel &&
            (onClick ? "cursor-pointer transition-opacity hover:opacity-80" : "cursor-default"),
          fillCell
            ? "h-auto w-auto max-h-full max-w-full object-contain"
            : fitMax
              ? "h-auto w-auto min-h-0 min-w-0 max-h-full max-w-full object-contain"
              : keepAspectRatio
                ? "object-contain"
                : "object-fill",
          imageSrc && !urlLoaded && "opacity-0",
          imageSrc && urlLoaded && "opacity-100 transition-opacity duration-200",
        )}
        style={{
          ...(fillCell || fitMax
            ? {}
            : {
                width: width ? `${width}px` : undefined,
                height: height ? `${height}px` : undefined,
              }),
          imageRendering: "pixelated",
        }}
        onLoad={() => {
          setUrlLoaded(true);
        }}
        onError={() => setDecodeError(true)}
      />
    </div>
  );

  if (error && retryCount >= maxRetries) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted", rounded && "rounded", className)}
        style={boxStyle}
      >
        <span className="text-xs text-destructive">Error</span>
      </div>
    );
  }

  if (loading || !imageSrc) {
    return (
      <>
        {enableClickModel ? (
          <div
            role="button"
            tabIndex={0}
            className={cn(thumbShellClass, className)}
            style={fillCell ? cellFillStyle : boxStyle}
            onClick={onThumbShellClick}
            onKeyDown={onThumbShellKeyDown}
          >
            <div className={cn(fillCell && "flex min-h-0 min-w-0 flex-1 flex-col")}>{loadingSlot}</div>
          </div>
        ) : (
          loadingSlot
        )}
        {spriteModalElement}
      </>
    );
  }

  if (decodeError) {
    return (
      <>
        <div
          className={cn("flex items-center justify-center bg-muted", rounded && "rounded-md", className)}
          style={boxStyle}
        >
          <span className="text-xs text-destructive">Error</span>
        </div>
        {spriteModalElement}
      </>
    );
  }

  return (
    <>
      {enableClickModel ? (
        <div
          role="button"
          tabIndex={0}
          className={cn(thumbShellClass, className)}
          style={fillCell ? cellFillStyle : undefined}
          onClick={onThumbShellClick}
          onKeyDown={onThumbShellKeyDown}
        >
          {thumbInner}
        </div>
      ) : (
        thumbInner
      )}
      {spriteModalElement}
    </>
  );
}
