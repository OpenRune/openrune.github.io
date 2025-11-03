import React, { useState, useEffect, MouseEventHandler, useMemo } from "react";
import { buildUrl, fetchFromBuildUrl } from "@/lib/api/apiClient";
import { toast } from "sonner";
import { useCacheType } from "@/components/layout/cache-type-provider";
import {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RSColorBox from "@/components/ui/RSColorBox";

interface RSSpriteProps {
    id: number | string;
    width?: number;
    height?: number;
    keepAspectRatio?: boolean;
    rounded?: boolean;
    thumbnail?: boolean;
    onClick?: MouseEventHandler<HTMLImageElement>;
    saveSprite?: boolean;
    enableClickModel?: boolean;
    gameval?: string;
    extraData?: any;
    modalOpen?: boolean;
    onModalOpenChange?: (open: boolean) => void;
    showInfoTab?: boolean;
    textureId?: number; // Texture ID when viewing from texture context
}

const RSSprite: React.FC<RSSpriteProps> = ({
                                               id,
                                               width,
                                               height,
                                               keepAspectRatio = true,
                                               rounded = false,
                                               thumbnail = false,
                                               onClick,
                                               saveSprite = false,
                                               enableClickModel = false,
                                               gameval,
                                               extraData,
                                               modalOpen: externalModalOpen,
                                               onModalOpenChange: externalOnModalOpenChange,
                                               showInfoTab = true,
                                               textureId,
                                           }) => {
    const { selectedCacheType } = useCacheType();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [internalModalOpen, setInternalModalOpen] = useState(false);
    
    // Use external state if provided, otherwise use internal state
    const modalOpen = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;
    const setModalOpen = externalOnModalOpenChange || setInternalModalOpen;

    const maxRetries = 3;
    const retryDelay = 2000;

    const spriteUrl = useMemo(() => buildUrl(`/public/sprite/${id}`, {
        width,
        height,
        keepAspectRatio,
    }), [id, width, height, keepAspectRatio]);

    const fullSizeSpriteUrl = useMemo(() => buildUrl(`/public/sprite/${id}`), [id]);

    useEffect(() => {
        const cacheTypeId = selectedCacheType?.id || 'default';
        const cacheKey = `sprite_${cacheTypeId}_${id}_${width}_${height}_${keepAspectRatio}`;
        
        if (saveSprite) {
            const cached = localStorage.getItem(cacheKey);
            // Validate cached image is a valid data URL for an image
            const isValidImageDataUrl = cached && cached.startsWith('data:image/');
            if (cached && isValidImageDataUrl) {
                setImageSrc(cached);
                setLoading(false);
                setError(null);
                return;
            } else if (cached && !isValidImageDataUrl) {
                // Invalid/corrupted cache - clear it
                localStorage.removeItem(cacheKey);
            }
        }

        setLoading(true);
        fetchFromBuildUrl(`/public/sprite/${id}`, {
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

    const copyImageUrl = async () => {
        try {
            const url = buildUrl(`/public/sprite/${id}`, {
                width,
                height,
                keepAspectRatio,
            });
            await navigator.clipboard.writeText(url);
            toast.success("Copied sprite URL");
        } catch {
            toast.error("Failed to copy URL");
        }
    };

    const downloadImage = () => {
        if (!imageSrc) return;
        const link = document.createElement("a");
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

    if (error && retryCount >= maxRetries) return <div className="text-red-600">Error loading image</div>;
    if (loading) return <div className="text-gray-500">Loading...</div>;

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <img
                        src={imageSrc ?? undefined}
                        alt={`Sprite ${id}`}
                        onClick={handleImageClick}
                        draggable={false}
                        className={`
            ${rounded ? "rounded-md" : ""}
            ${thumbnail ? "border shadow-sm border-primary" : ""}
            ${enableClickModel || onClick ? "cursor-pointer" : "cursor-default"}
            object-${keepAspectRatio ? "contain" : "fill"}
          `}
                        style={{
                            width: width ? `${width}px` : undefined,
                            height: height ? `${height}px` : undefined,
                        }}
                    />
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem onClick={copyImageUrl}>Copy URL</ContextMenuItem>
                    <ContextMenuItem onClick={downloadImage}>Download</ContextMenuItem>
                    <ContextMenuItem onClick={() => toast.info(`Sprite ID: ${id}`)}>Show ID</ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>

            {enableClickModel && (() => {
                // Check if texture data is available (has texture-specific fields)
                const hasTextureData = extraData && (
                    extraData.spriteCrc !== undefined ||
                    extraData.animationDirection !== undefined ||
                    (extraData.isTransparent !== undefined && extraData.animationSpeed !== undefined)
                );
                const tabCount = (hasTextureData ? 1 : 0) + 1; // Sprite + Texture (if texture)

                return (
                    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle>
                                    {textureId !== undefined ? (
                                        <>Texture: {textureId} [Sprite: {gameval ? `${gameval}` : ''} ({id})]</>
                                    ) : (
                                        <>Sprite: {gameval ? `${gameval}` : ''} [{id}]</>
                                    )}
                                </DialogTitle>
                            </DialogHeader>
                            <Tabs defaultValue="sprite" className="flex-1 flex flex-col overflow-hidden">
                                <TabsList className={`mb-4 w-full grid ${
                                    tabCount === 1 ? 'grid-cols-1' : 'grid-cols-2'
                                }`}>
                                    <TabsTrigger value="sprite" className="flex-1">Sprite</TabsTrigger>
                                    {hasTextureData && (
                                        <TabsTrigger value="texture" className="flex-1">Texture</TabsTrigger>
                                    )}
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
                                {hasTextureData && (
                                    <TabsContent value="texture" className="flex-1 overflow-auto mt-0">
                                        {extraData ? (
                                            <div className="space-y-4 text-sm">
                                                <div className="space-y-3">
                                                    {extraData.id !== undefined && (
                                                        <div className="flex items-center gap-4">
                                                            <div className="min-w-[150px]">
                                                                <strong>Texture ID:</strong>
                                                            </div>
                                                            <div className="flex-1 break-words">
                                                                {extraData.id}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {extraData.fileId !== undefined && (
                                                        <div className="flex items-center gap-4">
                                                            <div className="min-w-[150px]">
                                                                <strong>File ID:</strong>
                                                            </div>
                                                            <div className="flex-1 break-words">
                                                                {extraData.fileId}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {extraData.isTransparent !== undefined && (
                                                        <div className="flex items-center gap-4">
                                                            <div className="min-w-[150px]">
                                                                <strong>Transparent:</strong>
                                                            </div>
                                                            <div className="flex-1">
                                                                {extraData.isTransparent ? 'Yes' : 'No'}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {extraData.averageRgb !== undefined && (
                                                        <div className="flex items-center gap-4">
                                                            <div className="min-w-[150px] flex-shrink-0">
                                                                <strong>Average RGB:</strong>
                                                            </div>
                                                            <div className="flex-shrink-0">
                                                                <RSColorBox
                                                                    width={32}
                                                                    height={32}
                                                                    packedHsl={extraData.averageRgb}
                                                                    showHex={false}
                                                                    tooltip={true}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                    {extraData.animationDirection !== undefined && (
                                                        <div className="flex items-center gap-4">
                                                            <div className="min-w-[150px]">
                                                                <strong>Animation Direction:</strong>
                                                            </div>
                                                            <div className="flex-1">
                                                                {extraData.animationDirection}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {extraData.animationSpeed !== undefined && (
                                                        <div className="flex items-center gap-4">
                                                            <div className="min-w-[150px]">
                                                                <strong>Animation Speed:</strong>
                                                            </div>
                                                            <div className="flex-1">
                                                                {extraData.animationSpeed}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {extraData.spriteCrc !== undefined && (
                                                        <div className="flex items-center gap-4">
                                                            <div className="min-w-[150px]">
                                                                <strong>Sprite CRC:</strong>
                                                            </div>
                                                            <div className="flex-1 font-mono">
                                                                {extraData.spriteCrc}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {extraData.attachments && (
                                                    <div className="border-t pt-4">
                                                        <h4 className="font-semibold mb-2">Attachments</h4>
                                                        {extraData.attachments.total !== undefined && (
                                                            <div className="mb-2"><strong>Total:</strong> {extraData.attachments.total}</div>
                                                        )}
                                                        {extraData.attachments.overlays && extraData.attachments.overlays.length > 0 && (
                                                            <div className="mb-4">
                                                                <strong>Overlays:</strong>
                                                                <div className="max-h-40 overflow-y-auto border rounded p-2 mt-2">
                                                                    <ul className="list-disc ml-4">
                                                                        {extraData.attachments.overlays.map((overlay: any, idx: number) => (
                                                                            <li key={idx}>{overlay}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {extraData.attachments.models && (
                                                            <>
                                                                {extraData.attachments.models.items && extraData.attachments.models.items.length > 0 && (
                                                                    <div className="mb-4">
                                                                        <strong>Items:</strong>
                                                                        <div className="max-h-40 overflow-y-auto border rounded p-2 mt-2">
                                                                            <ul className="list-disc ml-4">
                                                                                {extraData.attachments.models.items.map((item: any, i: number) => (
                                                                                    <li key={`item-${i}`}>
                                                                                        {item.name} (ID: {item.id})
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {extraData.attachments.models.objects && extraData.attachments.models.objects.length > 0 && (
                                                                    <div className="mb-4">
                                                                        <strong>Objects:</strong>
                                                                        <div className="max-h-40 overflow-y-auto border rounded p-2 mt-2">
                                                                            <ul className="list-disc ml-4">
                                                                                {extraData.attachments.models.objects.map((obj: any, i: number) => (
                                                                                    <li key={`obj-${i}`}>
                                                                                        {obj.name} (ID: {obj.id})
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {extraData.attachments.models.npcs && extraData.attachments.models.npcs.length > 0 && (
                                                                    <div className="mb-4">
                                                                        <strong>NPCs:</strong>
                                                                        <div className="max-h-40 overflow-y-auto border rounded p-2 mt-2">
                                                                            <ul className="list-disc ml-4">
                                                                                {extraData.attachments.models.npcs.map((npc: any, i: number) => (
                                                                                    <li key={`npc-${i}`}>
                                                                                        {npc.name} (ID: {npc.id})
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-muted-foreground">No texture information available</div>
                                        )}
                                    </TabsContent>
                                )}
                            </Tabs>
                        </DialogContent>
                    </Dialog>
                );
            })()}
        </>
    );
};

export default RSSprite;
