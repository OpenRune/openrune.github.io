"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RspLoadingSlot } from "@/components/ui/rsp-loading-slot";
import { RSSprite } from "@/components/ui/RSSprite";
import { useCacheType } from "@/context/cache-type-context";
import { SPRITETYPES, useGamevals } from "@/context/gameval-context";
import { cacheProxyHeaders, cacheTexturesSnapshotUrl, diffSpriteResolveUrl, texturesProxyUrl } from "@/lib/cache-proxy-client";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";
import { cn } from "@/lib/utils";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read texture"));
    reader.readAsDataURL(blob);
  });
}

export type RSTextureProps = {
  id?: string | number;
  width?: number;
  height?: number;
  rounded?: boolean;
  className?: string;
  keepAspectRatio?: boolean;
  enableClickModel?: boolean;
  modalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
  modalTitle?: string;
  /** When set, use this URL for the thumbnail (e.g. diff combined texture URL). */
  imageUrl?: string;
  /** Full-size / modal image URL (defaults to `imageUrl`). */
  fullSizeImageUrl?: string;
  /** Revision for cache `textures` API when not using `imageUrl`. */
  rev?: number;
  base?: number;
  fitMax?: boolean;
  /**
   * Textures config: `fileId` is a sprite id; load pixels via combined diff sprite resolve
   * and render with `RSSprite` (same as openrune textures table) instead of the `textures` API.
   */
  combinedDiffSprite?: boolean;
  /** Textures table row id (definition id); passed to `RSSprite` as `textureId` for the modal title. */
  textureDefinitionId?: number;
  /** Sprite gameval name when using `combinedDiffSprite` (same as `RSSprite`). */
  gameval?: string;
  /** Revision for sprite gameval lookup in modal (defaults to `rev`). */
  gamevalRevision?: number;
  /** Stretch loading / thumb to fill a `relative` parent (e.g. bordered texture cell). */
  fillCell?: boolean;
};

/**
 * Texture preview: either decodes from the cache `textures` API, or — for textures config rows —
 * treats `id` as the config `fileId` (sprite id) and delegates to `RSSprite` + `diff/sprite` resolve.
 */
export function RSTexture(props: RSTextureProps) {
  const {
    combinedDiffSprite,
    textureDefinitionId,
    id,
    rev,
    base,
    width = 32,
    height = 32,
    rounded = false,
    className = "",
    keepAspectRatio = false,
    enableClickModel = false,
    modalOpen,
    onModalOpenChange,
    modalTitle,
    fitMax = false,
    fillCell = false,
    gameval,
    gamevalRevision,
  } = props;

  const { selectedCacheType } = useCacheType();
  const { loadGamevalType, lookupGameval, getGamevalExtra } = useGamevals();
  const hasExplicitId = id !== undefined && id !== null && Number.isFinite(Number(id));
  const hasTextureDefId =
    typeof textureDefinitionId === "number" && Number.isFinite(textureDefinitionId) && textureDefinitionId >= 0;
  const shouldResolveTextureDefId = Boolean(combinedDiffSprite && !hasExplicitId && hasTextureDefId && rev != null);
  const [resolvedFileId, setResolvedFileId] = React.useState<number | null>(null);
  const [resolveReady, setResolveReady] = React.useState<boolean>(!shouldResolveTextureDefId);

  React.useEffect(() => {
    if (!shouldResolveTextureDefId) {
      setResolveReady(true);
      setResolvedFileId(null);
      return;
    }

    let cancelled = false;
    setResolveReady(false);
    setResolvedFileId(null);

    const run = async () => {
      try {
        // Fetch the full texture definitions snapshot for this revision, then pick out the fileId.
        const url = cacheTexturesSnapshotUrl(Number(rev));
        const cacheKey = `cache:textures:snapshot:${selectedCacheType.id}:${rev}`;
        const { data } = await conditionalJsonFetch<Record<string, unknown>>(cacheKey, url, {
          headers: cacheProxyHeaders(selectedCacheType),
        });

        if (cancelled) return;

        // Response shape: { snapshots: { "<id>": { fileId: N, ... } } } or { snapshot: {...}, id: N }
        let def: Record<string, unknown> | null = null;
        const defId = String(textureDefinitionId);
        if (data.snapshots && typeof data.snapshots === "object" && !Array.isArray(data.snapshots)) {
          const snap = (data.snapshots as Record<string, unknown>)[defId];
          if (snap && typeof snap === "object") def = snap as Record<string, unknown>;
        } else if (data.snapshot && typeof data.snapshot === "object" && !Array.isArray(data.snapshot)) {
          if (String(data.id) === defId) def = data.snapshot as Record<string, unknown>;
        }
        let found: number | null = null;
        if (def) {
          for (const key of ["fileId", "file_id", "spriteId", "sprite_id", "fileID", "spriteID", "fileid"]) {
            const v = Number(def[key]);
            if (Number.isFinite(v) && v >= 0) {
              found = v;
              break;
            }
          }
        }
        setResolvedFileId(found);
      } catch {
        if (!cancelled) setResolvedFileId(null);
      } finally {
        if (!cancelled) setResolveReady(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [shouldResolveTextureDefId, rev, textureDefinitionId, selectedCacheType]);

  const resolvedSpriteId = hasExplicitId
    ? Number(id)
    : shouldResolveTextureDefId
      ? resolvedFileId
      : null;

  React.useEffect(() => {
    if (!combinedDiffSprite || typeof rev !== "number") return;
    if (!Number.isFinite(resolvedSpriteId)) return;
    void loadGamevalType(SPRITETYPES, gamevalRevision ?? rev);
  }, [combinedDiffSprite, resolvedSpriteId, rev, gamevalRevision, loadGamevalType]);

  const resolvedSpriteGameval = React.useMemo(() => {
    if (gameval?.trim()) return gameval.trim();
    if (!combinedDiffSprite || typeof rev !== "number") return undefined;
    if (!Number.isFinite(resolvedSpriteId)) return undefined;
    const spriteId = Number(resolvedSpriteId);
    return (
      lookupGameval(SPRITETYPES, spriteId, gamevalRevision ?? rev)?.trim() ||
      getGamevalExtra(SPRITETYPES, spriteId, gamevalRevision ?? rev)?.searchable?.trim() ||
      undefined
    );
  }, [combinedDiffSprite, gameval, rev, resolvedSpriteId, lookupGameval, getGamevalExtra, gamevalRevision]);

  if (combinedDiffSprite && typeof rev === "number" && Number.isFinite(resolvedSpriteId)) {
    const spriteId = Number(resolvedSpriteId);
    const spriteUrl = diffSpriteResolveUrl(spriteId, { base: base ?? 1, rev });
    return (
      <RSSprite
        id={spriteId}
        textureId={textureDefinitionId}
        gameval={resolvedSpriteGameval}
        gamevalRevision={gamevalRevision ?? rev}
        width={width}
        height={height}
        rounded={rounded}
        className={className}
        keepAspectRatio={keepAspectRatio}
        enableClickModel={enableClickModel}
        modalOpen={modalOpen}
        onModalOpenChange={onModalOpenChange}
        modalTitle={modalTitle}
        imageUrl={spriteUrl}
        fullSizeImageUrl={spriteUrl}
        rev={rev}
        base={base}
        fitMax={fitMax}
        fillCell={fillCell}
      />
    );
  }

  if (shouldResolveTextureDefId && !resolveReady) {
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
    return (
      <RspLoadingSlot
        className={cn(fillCell && "min-h-0 flex-1", className)}
        style={fillCell ? cellFillStyle : boxStyle}
        rounded={rounded}
        ariaLabel="Resolving texture"
      />
    );
  }

  const archiveId = id ?? textureDefinitionId;
  if (archiveId == null) {
    return (
      <TextureThumbFallback
        rounded={rounded}
        className={className}
        style={fitMax ? { maxWidth: width, maxHeight: height } : { width, height }}
        label="Texture id missing"
      />
    );
  }

  return <RSTextureFromArchive {...props} id={archiveId} />;
}

function TextureThumbFallback({
  rounded,
  className,
  style,
  label,
}: {
  rounded: boolean;
  className: string;
  style: React.CSSProperties;
  label: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-muted/50 text-muted-foreground",
        rounded && "rounded-md",
        className,
      )}
      style={style}
      role="img"
      aria-label={label}
    >
      <span className="text-xs" aria-hidden>
        —
      </span>
    </div>
  );
}

function RSTextureFromArchive({
  combinedDiffSprite: _combined,
  textureDefinitionId: _texDef,
  gameval: _gv,
  gamevalRevision: _gvr,
  id,
  width = 32,
  height = 32,
  rounded = false,
  className = "",
  keepAspectRatio = false,
  enableClickModel = false,
  modalOpen: externalModalOpen,
  onModalOpenChange: externalOnModalOpenChange,
  modalTitle,
  imageUrl: imageUrlOverride,
  fullSizeImageUrl: fullSizeImageUrlOverride,
  rev,
  base,
  fitMax = false,
  fillCell = false,
}: RSTextureProps & { id: string | number }) {
  const { selectedCacheType } = useCacheType();
  const numericId = Number(id);
  const invalidId = !Number.isFinite(numericId) || numericId < 0;

  const [imageSrc, setImageSrc] = React.useState<string | null>(() => imageUrlOverride ?? null);
  const [loading, setLoading] = React.useState(() => !imageUrlOverride);
  const [urlLoaded, setUrlLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const [internalModalOpen, setInternalModalOpen] = React.useState(false);
  const [decodeError, setDecodeError] = React.useState(false);
  const thumbImgRef = React.useRef<HTMLImageElement | null>(null);

  const modalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;
  const setModalOpen = externalOnModalOpenChange ?? setInternalModalOpen;

  const maxRetries = 3;
  const retryDelay = 2000;

  const fullSizeTextureUrl = React.useMemo(() => {
    if (fullSizeImageUrlOverride) return fullSizeImageUrlOverride;
    return texturesProxyUrl({
      id,
      width: 512,
      height: 512,
      keepAspectRatio: true,
      rev,
      base,
    });
  }, [id, rev, base, fullSizeImageUrlOverride]);

  const copyImageUrl = async () => {
    try {
      const urlToCopy =
        typeof window !== "undefined" && fullSizeTextureUrl.startsWith("/")
          ? `${window.location.origin}${fullSizeTextureUrl}`
          : fullSizeTextureUrl;
      await navigator.clipboard.writeText(urlToCopy);
    } catch {
      // Ignore clipboard failures.
    }
  };

  const downloadImage = () => {
    const url = fullSizeTextureUrl;
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `texture-${id}.png`;
    link.click();
  };

  React.useEffect(() => {
    if (!imageUrlOverride) return;
    setImageSrc(imageUrlOverride);
    setUrlLoaded(false);
    setError(null);
    setDecodeError(false);
    setLoading(false);
  }, [imageUrlOverride]);

  /** Same as RSSprite: memory-cached images may never fire `load`, leaving the thumb stuck at opacity 0. */
  React.useLayoutEffect(() => {
    if (!imageUrlOverride || !imageSrc) return;
    const el = thumbImgRef.current;
    if (el?.complete && el.naturalWidth > 0) {
      setUrlLoaded(true);
    }
  }, [imageUrlOverride, imageSrc]);

  React.useEffect(() => {
    if (imageUrlOverride) return;
    if (invalidId) {
      setLoading(false);
      setImageSrc(null);
      setError(null);
      setDecodeError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDecodeError(false);
    setError(null);

    const url = texturesProxyUrl({ id, width, height, keepAspectRatio, rev, base });
    fetch(url, { headers: cacheProxyHeaders(selectedCacheType), cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load texture ${id}`);
        const ct = response.headers.get("content-type") ?? "";
        if (ct.includes("application/json") || ct.includes("text/")) {
          throw new Error(`Texture ${id} returned non-image`);
        }
        return response.blob();
      })
      .then((blob) => {
        if (blob.size === 0) throw new Error(`Texture ${id} empty`);
        return blobToDataUrl(blob);
      })
      .then((dataUrl) => {
        if (cancelled) return;
        setImageSrc(dataUrl);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load texture");
        if (retryCount < maxRetries) {
          window.setTimeout(() => setRetryCount((p) => p + 1), retryDelay);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    id,
    width,
    height,
    keepAspectRatio,
    retryCount,
    selectedCacheType.id,
    selectedCacheType.ip,
    selectedCacheType.port,
    imageUrlOverride,
    base,
    rev,
    invalidId,
  ]);

  React.useEffect(() => {
    setDecodeError(false);
  }, [imageSrc]);

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
    !fillCell && fitMax && "inline-flex min-h-0 min-w-0 items-center justify-center",
    !fillCell && !fitMax && "inline-block",
    rounded && "rounded-md",
    className,
  );

  if (invalidId) {
    return (
      <TextureThumbFallback
        rounded={rounded}
        className={className}
        style={boxStyle}
        label={`Texture id invalid (${String(id)})`}
      />
    );
  }

  if (!imageUrlOverride) {
    if (error && retryCount >= maxRetries) {
      return (
        <TextureThumbFallback
          rounded={rounded}
          className={className}
          style={boxStyle}
          label={`Texture ${id} unavailable`}
        />
      );
    }
    if (loading || !imageSrc) {
      return (
        <RspLoadingSlot
          className={cn(fillCell && "min-h-0 flex-1", className)}
          style={fillCell ? cellFillStyle : boxStyle}
          rounded={rounded}
          ariaLabel="Loading texture"
        />
      );
    }
  } else if (!imageSrc) {
    return (
      <RspLoadingSlot
        className={cn(fillCell && "min-h-0 flex-1", className)}
        style={fillCell ? cellFillStyle : boxStyle}
        rounded={rounded}
        ariaLabel="Loading texture"
      />
    );
  }

  if (decodeError) {
    return (
      <TextureThumbFallback
        rounded={rounded}
        className={className}
        style={boxStyle}
        label={`Texture ${id} could not be displayed`}
      />
    );
  }

  return (
    <>
      <div className={thumbWrapperClass} style={boxStyle}>
        {imageUrlOverride && !urlLoaded ? (
          <div className="absolute inset-0 z-[1] overflow-hidden rounded-[inherit]" aria-hidden>
            <RspLoadingSlot className="h-full w-full rounded-[inherit]" decorative rounded={false} />
          </div>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={thumbImgRef}
          key={typeof imageUrlOverride === "string" ? imageUrlOverride : `texture-${id}`}
          src={imageSrc ?? undefined}
          alt={`Texture ${id}`}
          onClick={() => {
            if (enableClickModel) setModalOpen(true);
          }}
          draggable={false}
          decoding="async"
          loading="lazy"
          className={cn(
            rounded && "rounded-md",
            enableClickModel ? "cursor-pointer transition-opacity hover:opacity-80" : "cursor-default",
            fillCell
              ? "h-auto w-auto max-h-full max-w-full object-contain"
              : fitMax
                ? "h-auto w-auto min-h-0 min-w-0 max-h-full max-w-full object-contain"
                : keepAspectRatio
                  ? "object-contain"
                  : "object-fill",
            imageUrlOverride && !urlLoaded && "opacity-0",
            imageUrlOverride && urlLoaded && "opacity-100 transition-opacity duration-200",
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
            setDecodeError(false);
            if (imageUrlOverride) setUrlLoaded(true);
          }}
          onError={() => setDecodeError(true)}
        />
      </div>

      {enableClickModel ? (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="flex h-[min(500px,85vh)] max-w-4xl flex-col" showCloseButton>
            <DialogHeader className="shrink-0">
              <DialogTitle>{modalTitle ?? `Texture [${id}]`}</DialogTitle>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullSizeTextureUrl}
                alt={`Texture ${id}`}
                className="max-h-[60vh] max-w-full object-contain"
                draggable={false}
                decoding="async"
                style={{ imageRendering: "pixelated" }}
              />
              <div className="mt-4 flex shrink-0 justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void copyImageUrl()}>
                  Copy URL
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={downloadImage}>
                  Download
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
