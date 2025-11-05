'use client';

import { useState, useMemo, useEffect, useCallback, type MouseEventHandler } from 'react';
import { buildUrl, fetchFromBuildUrl } from '@/lib/api/apiClient';
import { toast } from 'sonner';
import { useCacheType } from '@/components/layout/cache-type-provider';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconLoader2 } from '@tabler/icons-react';
import type { ReactNode } from 'react';

export interface ExtraTab {
  value: string;
  label: string;
  content: ReactNode;
}

interface RSSpriteProps {
  id: string | number;
  width?: number;
  height?: number;
  rounded?: boolean;
  thumbnail?: boolean;
  enableClickModel?: boolean;
  showInfoTab?: boolean;
  gameval?: string;
  className?: string;
  keepAspectRatio?: boolean;
  onClick?: MouseEventHandler<HTMLImageElement>;
  saveSprite?: boolean;
  extraData?: any;
  modalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
  textureId?: number;
  extraTabs?: ExtraTab[];
  modalTitle?: string;
}

export function RSSprite({
  id,
  width = 32,
  height = 32,
  rounded = false,
  thumbnail = false,
  enableClickModel = false,
  showInfoTab = true,
  gameval,
  className = '',
  keepAspectRatio = false,
  onClick,
  saveSprite = false,
  extraData,
  modalOpen: externalModalOpen,
  onModalOpenChange: externalOnModalOpenChange,
  textureId,
  extraTabs = [],
  modalTitle,
}: RSSpriteProps) {
  const { selectedCacheType } = useCacheType();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [subsprites, setSubsprites] = useState<any[]>([]);
  const [loadingSubsprites, setLoadingSubsprites] = useState(false);
  const [subspritesError, setSubspritesError] = useState<string | null>(null);

  const modalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;
  const setModalOpen = externalOnModalOpenChange || setInternalModalOpen;

  const maxRetries = 3;
  const retryDelay = 2000;

  const imageUrl = useMemo(() => {
    const params = new URLSearchParams({
      id: String(id),
      width: String(width),
      height: String(height),
      keepAspectRatio: String(keepAspectRatio),
    });
    return `/api/sprites?${params.toString()}`;
  }, [id, width, height, keepAspectRatio]);

  const fullSizeSpriteUrl = useMemo(() => {
    const params = new URLSearchParams({
      id: String(id),
    });
    return `/api/sprites?${params.toString()}`;
  }, [id]);

  const fetchSubsprites = useCallback(async () => {
    if (loadingSubsprites || subsprites.length > 0) return;
    
    setLoadingSubsprites(true);
    setSubspritesError(null);
    
    try {
      const spriteCount = extraData?.count || 0;
      
      if (spriteCount > 1) {
        const fetchPromises = [];
        for (let index = 0; index < spriteCount; index++) {
          fetchPromises.push(
            fetchFromBuildUrl('sprites', {
              id: String(id),
              indexed: index,
            })
              .then(async (response) => {
                if (response.ok) {
                  const blob = await response.blob();
                  return new Promise<{ index: number; imageUrl: string }>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      resolve({
                        index,
                        imageUrl: reader.result as string,
                      });
                    };
                    reader.readAsDataURL(blob);
                  });
                }
                return null;
              })
              .catch(() => null)
          );
        }
        
        const results = await Promise.all(fetchPromises);
        const validSubsprites = results.filter((r): r is { index: number; imageUrl: string } => r !== null);
        setSubsprites(validSubsprites.sort((a, b) => a.index - b.index));
      }
    } catch (err) {
      setSubspritesError(err instanceof Error ? err.message : 'Failed to load subsprites');
    } finally {
      setLoadingSubsprites(false);
    }
  }, [id, extraData?.count, loadingSubsprites, subsprites.length]);

  // Fetch image
  useEffect(() => {
    const cacheTypeId = selectedCacheType?.id || 'default';
    const cacheKey = `sprite_${cacheTypeId}_${id}_${width}_${height}_${keepAspectRatio}`;

    if (saveSprite) {
      const cached = localStorage.getItem(cacheKey);
      const isValidImageDataUrl = cached && cached.startsWith('data:image/');

      if (cached && isValidImageDataUrl) {
        setImageSrc(cached);
        setLoading(false);
        setError(null);
        return;
      } else if (cached && !isValidImageDataUrl) {
        localStorage.removeItem(cacheKey);
      }
    }

    setLoading(true);
    fetchFromBuildUrl('sprites', {
      id: String(id),
      width,
      height,
      keepAspectRatio,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load sprite ${id}`);
        return response.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          if (saveSprite) {
            localStorage.setItem(cacheKey, dataUrl);
          }
          setImageSrc(dataUrl);
        };
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        setError(err.message);
        if (retryCount < maxRetries) {
          setTimeout(() => setRetryCount((prev) => prev + 1), retryDelay);
        }
      })
      .finally(() => setLoading(false));
  }, [id, width, height, keepAspectRatio, retryCount, saveSprite, selectedCacheType?.id]);

  // Fetch subsprites when modal opens and we have sprite data
  useEffect(() => {
    if (modalOpen && enableClickModel && !loadingSubsprites && subsprites.length === 0 && extraData?.count && extraData.count > 1) {
      fetchSubsprites();
    }
  }, [modalOpen, enableClickModel, id, extraData?.count, fetchSubsprites, loadingSubsprites, subsprites.length]);

  const copyImageUrl = async () => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast.success('Copied sprite URL');
    } catch {
      toast.error('Failed to copy URL');
    }
  };

  const downloadImage = () => {
    if (!imageSrc) return;
    const link = document.createElement('a');
    link.href = fullSizeSpriteUrl;
    link.download = `sprite-${id}.png`;
    link.click();
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (enableClickModel) {
      setModalOpen(true);
    }
    if (onClick) {
      onClick(e);
    }
  };

  const hasSubsprites = subsprites.length > 0 || (extraData?.count && extraData.count > 1);
  const tabCount = (hasSubsprites ? 1 : 0) + extraTabs.length + 1;

  // Early returns after all hooks
  if (error && retryCount >= maxRetries) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${rounded ? 'rounded' : ''} ${className}`}
        style={{ width, height }}
      >
        <span className="text-xs text-red-600">Error</span>
      </div>
    );
  }

  if (loading) {
    const spinnerSize = Math.min(width || 32, height || 32) * 0.5;
    return (
      <div
        className={`flex items-center justify-center bg-muted ${rounded ? 'rounded' : ''} ${className}`}
        style={{ width, height }}
      >
        <IconLoader2
          className="animate-spin text-muted-foreground"
          style={{ width: spinnerSize, height: spinnerSize }}
        />
      </div>
    );
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={`inline-block ${rounded ? 'rounded' : ''} ${className}`}
            style={{ width, height }}
          >
            <img
              src={imageSrc ?? undefined}
              alt={gameval || `Sprite ${id}`}
              onClick={handleImageClick}
              draggable={false}
              className={`
                ${rounded ? 'rounded-md' : ''}
                ${thumbnail ? 'border shadow-sm border-primary' : ''}
                ${enableClickModel || onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}
                object-${keepAspectRatio ? 'contain' : 'fill'}
              `}
              style={{
                width: width ? `${width}px` : undefined,
                height: height ? `${height}px` : undefined,
              }}
              onError={() => setError('Failed to load image')}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={copyImageUrl}>Copy URL</ContextMenuItem>
          <ContextMenuItem onClick={downloadImage}>Download</ContextMenuItem>
          <ContextMenuItem onClick={() => toast.info(`Sprite ID: ${id}`)}>Show ID</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {enableClickModel && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-4xl h-[500px] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>
                {modalTitle || (textureId !== undefined ? (
                  <>Texture: {textureId} [Sprite: {gameval ? `${gameval}` : ''} ({id})]</>
                ) : (
                  <>Sprite: {gameval ? `${gameval}` : ''} [{id}]</>
                ))}
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="sprite" className="flex-1 flex flex-col overflow-hidden min-h-0">
              <TabsList className={`mb-4 w-full grid ${tabCount === 1 ? 'grid-cols-1' : tabCount === 2 ? 'grid-cols-2' : tabCount === 3 ? 'grid-cols-3' : tabCount === 4 ? 'grid-cols-4' : 'grid-cols-5'}`}>
                <TabsTrigger value="sprite" className="flex-1">
                  Sprite
                </TabsTrigger>
                {hasSubsprites && (
                  <TabsTrigger value="subsprites" className="flex-1">
                    Subsprites
                  </TabsTrigger>
                )}
                {extraTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="flex-1">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="sprite" className="flex-1 flex flex-col items-center justify-center overflow-auto p-4 mt-0">
                <img
                  src={fullSizeSpriteUrl}
                  alt={`Sprite ${id}`}
                  className="max-w-full max-h-[60vh] object-contain"
                  draggable={false}
                />
                <div className="flex gap-2 justify-center mt-4">
                  <Button variant="outline" onClick={copyImageUrl}>
                    Copy URL
                  </Button>
                  <Button variant="outline" onClick={downloadImage}>
                    Download
                  </Button>
                </div>
              </TabsContent>

              {(hasSubsprites || (extraData?.count && extraData.count > 1)) && (
                <TabsContent value="subsprites" className="flex-1 overflow-auto mt-0">
                  {loadingSubsprites ? (
                    <div className="flex items-center justify-center py-8">
                      <IconLoader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : subspritesError ? (
                    <div className="text-center text-destructive py-8">{subspritesError}</div>
                  ) : subsprites.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">No subsprites available</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
                      {subsprites.map((subsprite, idx) => {
                        const params = new URLSearchParams({
                          id: String(id),
                          indexed: String(subsprite.index),
                          width: '128',
                          height: '128',
                          keepAspectRatio: 'true',
                        });
                        const subspriteUrl = `/api/sprites?${params.toString()}`;
                        
                        return (
                          <div key={idx} className="flex flex-col items-center gap-2">
                            <div className="text-sm font-medium">Index {subsprite.index}</div>
                            <img
                              src={subsprite.imageUrl || subspriteUrl}
                              alt={`Subsprite ${subsprite.index}`}
                              className="max-w-full max-h-32 object-contain border rounded"
                              draggable={false}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              )}

              {extraTabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="flex-1 overflow-hidden mt-0 min-h-0">
                  {tab.content}
                </TabsContent>
              ))}
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

