'use client';

import React, { useState, useEffect, useMemo } from "react";
import { RSSprite, type ExtraTab } from "@/components/ui/RSSprite";
import { fetchFromBuildUrl } from "@/lib/api/apiClient";
import RSColorBox from '@/components/ui/RSColorBox';
import { Input } from '@/components/ui/input';

// Simple attachment list component
function AttachmentList({ items, searchKey, search, setSearch }: { items: any[]; searchKey: string; search: Record<string, string>; setSearch: (val: Record<string, string>) => void }) {
  const searchTerm = search[searchKey] || '';
  const filteredItems = items.filter((item: any) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const itemStr = typeof item === 'object' 
      ? `${item.id || ''} ${item.name || ''} ${item.gameval || ''}`.toLowerCase()
      : String(item).toLowerCase();
    return itemStr.includes(searchLower);
  });

  return (
    <ul className="space-y-1">
      {filteredItems.map((item: any, idx: number) => (
        <li key={idx} className="text-sm">
          {typeof item === 'object' ? (
            <span className="font-mono">{item.id || '-'}</span>
          ) : (
            <span className="font-mono">{item}</span>
          )}
          {typeof item === 'object' && item.name && (
            <span className="ml-2 text-muted-foreground">- {item.name}</span>
          )}
        </li>
      ))}
      {filteredItems.length === 0 && (
        <li className="text-muted-foreground text-sm">No items found</li>
      )}
    </ul>
  );
}

interface RSTextureProps {
    id: number;
    width?: number;
    height?: number;
    rounded?: boolean;
    thumbnail?: boolean;
    saveSprite?: boolean;
    enableClickModel?: boolean;
    gameval?: string;
    extraData?: any;
    modalOpen?: boolean;
    onModalOpenChange?: (open: boolean) => void;
    showInfoTab?: boolean;
    textureData?: any; // Optional: pass texture data directly to avoid lookup
}

// Module-level cache for textures (used when not provided by parent)
let texturesMap: Map<number, any> | null = null;
let texturesLoadPromise: Promise<Map<number, any>> | null = null;

// Export function to set the cache from external sources (e.g., TextureSearch table)
export function setTexturesCache(textures: any[]) {
    texturesMap = new Map();
    textures.forEach((texture: any) => {
        texturesMap!.set(texture.id, texture);
    });
}

async function loadTextures(): Promise<Map<number, any>> {
    // If already loaded, return the cache
    if (texturesMap) {
        return texturesMap;
    }

    // If currently loading, return the existing promise
    if (texturesLoadPromise) {
        return texturesLoadPromise;
    }

    // Start loading
    texturesLoadPromise = (async () => {
        try {
            const res = await fetchFromBuildUrl('/public/textures');
            if (!res.ok) {
                throw new Error(`Failed to load textures: ${res.status}`);
            }
            const data = await res.json();
            const results = data.results || [];
            
            // Create map: id -> texture
            texturesMap = new Map();
            results.forEach((texture: any) => {
                texturesMap!.set(texture.id, texture);
            });
            
            return texturesMap;
        } catch (error) {
            texturesLoadPromise = null; // Reset promise on error so we can retry
            return new Map<number, any>();
        }
    })();

    return texturesLoadPromise;
}

const RSTexture: React.FC<RSTextureProps> = ({
    id: textureId,
    width,
    height,
    rounded,
    thumbnail,
    saveSprite,
    enableClickModel,
    gameval,
    extraData,
    modalOpen,
    onModalOpenChange,
    showInfoTab,
    textureData: providedTextureData,
}) => {
    const [fileId, setFileId] = useState<number | null>(null);
    const [textureData, setTextureData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [attachmentSearch, setAttachmentSearch] = useState<Record<string, string>>({ activeTab: '' });

    useEffect(() => {
        async function getTexture() {
            // If texture data is provided, use it directly (no lookup needed)
            if (providedTextureData) {
                const fetchedFileId = providedTextureData.fileId || providedTextureData.extraData?.fileId;
                if (fetchedFileId !== undefined && fetchedFileId !== null) {
                    setFileId(fetchedFileId);
                    setTextureData(providedTextureData);
                } else {
                    setFileId(textureId);
                }
                setLoading(false);
                return;
            }

            // Otherwise, look up in cache
            try {
                const textures = await loadTextures();
                const texture = textures.get(textureId);
                
                if (texture) {
                    const fetchedFileId = texture.fileId || texture.extraData?.fileId;
                    if (fetchedFileId !== undefined && fetchedFileId !== null) {
                        setFileId(fetchedFileId);
                        setTextureData(texture);
                    } else {
                        // Try using texture ID directly as fallback
                        setFileId(textureId);
                    }
                } else {
                    // Texture not found in cache, try using texture ID directly as fallback
                    setFileId(textureId);
                }
            } catch {
                // On error, try using texture ID directly as fallback
                setFileId(textureId);
            } finally {
                setLoading(false);
            }
        }

        getTexture();
    }, [textureId, providedTextureData]);

    // Prepare extraData from texture if not provided (must be before early returns for hooks)
    const finalExtraData = extraData || (textureData ? {
        isTransparent: textureData.isTransparent,
        averageRgb: textureData.averageRgb,
        animationDirection: textureData.animationDirection,
        animationSpeed: textureData.animationSpeed,
        spriteCrc: textureData.spriteCrc,
        attachments: textureData.attachments,
    } : undefined);

    // Check which attachment types have data (must be before early returns for hooks)
    const hasOverlays = finalExtraData?.attachments?.overlays && finalExtraData.attachments.overlays.length > 0;
    const hasItems = finalExtraData?.attachments?.items && finalExtraData.attachments.items.length > 0;
    const hasObjects = finalExtraData?.attachments?.objects && finalExtraData.attachments.objects.length > 0;
    const hasNpcs = finalExtraData?.attachments?.npcs && finalExtraData.attachments.npcs.length > 0;
    const hasAnyAttachments = hasOverlays || hasItems || hasObjects || hasNpcs;

    // Create texture info tab (must be before early returns for hooks)
    const hasTextureData = finalExtraData && (
        finalExtraData.spriteCrc !== undefined ||
        finalExtraData.animationDirection !== undefined ||
        (finalExtraData.isTransparent !== undefined && finalExtraData.animationSpeed !== undefined)
    );

    // Build extra tabs array (must be before early returns for hooks)
    const extraTabs = useMemo(() => {
        const tabs: ExtraTab[] = [];
        
        // Texture info tab
        if (hasTextureData && finalExtraData) {
            tabs.push({
                value: 'texture',
                label: 'Texture',
                content: (
                    <div className="space-y-4 text-sm flex flex-col h-full p-4 overflow-auto">
                        {/* Render texture image */}
                        {textureId !== undefined && (
                            <div className="flex justify-center mb-4">
                                <RSTexture
                                    id={textureId}
                                    width={128}
                                    height={128}
                                    rounded
                                    thumbnail
                                    enableClickModel={false}
                                    textureData={finalExtraData}
                                    extraData={finalExtraData}
                                />
                            </div>
                        )}
                        <div className="space-y-3">
                            {finalExtraData.id !== undefined && (
                                <div className="flex items-center gap-4">
                                    <div className="min-w-[150px]">
                                        <strong>Texture ID:</strong>
                                    </div>
                                    <div className="flex-1 break-words">{finalExtraData.id}</div>
                                </div>
                            )}
                            {finalExtraData.fileId !== undefined && (
                                <div className="flex items-center gap-4">
                                    <div className="min-w-[150px]">
                                        <strong>File ID:</strong>
                                    </div>
                                    <div className="flex-1 break-words">{finalExtraData.fileId}</div>
                                </div>
                            )}
                            {finalExtraData.isTransparent !== undefined && (
                                <div className="flex items-center gap-4">
                                    <div className="min-w-[150px]">
                                        <strong>Transparent:</strong>
                                    </div>
                                    <div className="flex-1">{finalExtraData.isTransparent ? 'Yes' : 'No'}</div>
                                </div>
                            )}
                            {finalExtraData.averageRgb !== undefined && (
                                <div className="flex items-center gap-4">
                                    <div className="min-w-[150px] flex-shrink-0">
                                        <strong>Average RGB:</strong>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <RSColorBox
                                            width={32}
                                            height={32}
                                            packedHsl={finalExtraData.averageRgb}
                                            showHex={false}
                                            tooltip={true}
                                        />
                                    </div>
                                </div>
                            )}
                            {finalExtraData.animationDirection !== undefined && (
                                <div className="flex items-center gap-4">
                                    <div className="min-w-[150px]">
                                        <strong>Animation Direction:</strong>
                                    </div>
                                    <div className="flex-1">{finalExtraData.animationDirection}</div>
                                </div>
                            )}
                            {finalExtraData.animationSpeed !== undefined && (
                                <div className="flex items-center gap-4">
                                    <div className="min-w-[150px]">
                                        <strong>Animation Speed:</strong>
                                    </div>
                                    <div className="flex-1">{finalExtraData.animationSpeed}</div>
                                </div>
                            )}
                            {finalExtraData.spriteCrc !== undefined && (
                                <div className="flex items-center gap-4">
                                    <div className="min-w-[150px]">
                                        <strong>Sprite CRC:</strong>
                                    </div>
                                    <div className="flex-1 font-mono">{finalExtraData.spriteCrc}</div>
                                </div>
                            )}
                        </div>
                    </div>
                ),
            });
        }
        
        // Attachments tab
        if (hasAnyAttachments && finalExtraData) {
            tabs.push({
                value: 'attachments',
                label: `Attachments (${finalExtraData?.attachments?.total || 0})`,
                content: (
                    <div className="flex flex-col h-full p-4">
                        <div className="flex gap-2 mb-4 border-b flex-shrink-0">
                            {hasOverlays && (
                                <button
                                    onClick={() => setAttachmentSearch({ ...attachmentSearch, activeTab: 'overlays' })}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                        (attachmentSearch.activeTab === 'overlays' || (!attachmentSearch.activeTab && hasOverlays))
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Overlays ({finalExtraData?.attachments?.overlays?.length || 0})
                                </button>
                            )}
                            {hasItems && (
                                <button
                                    onClick={() => setAttachmentSearch({ ...attachmentSearch, activeTab: 'items' })}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                        attachmentSearch.activeTab === 'items'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Items ({finalExtraData?.attachments?.items?.length || 0})
                                </button>
                            )}
                            {hasObjects && (
                                <button
                                    onClick={() => setAttachmentSearch({ ...attachmentSearch, activeTab: 'objects' })}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                        attachmentSearch.activeTab === 'objects'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Objects ({finalExtraData?.attachments?.objects?.length || 0})
                                </button>
                            )}
                            {hasNpcs && (
                                <button
                                    onClick={() => setAttachmentSearch({ ...attachmentSearch, activeTab: 'npcs' })}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                        attachmentSearch.activeTab === 'npcs'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    NPCs ({finalExtraData?.attachments?.npcs?.length || 0})
                                </button>
                            )}
                        </div>

                        <div className="flex-shrink-0 mb-4">
                            <Input
                                placeholder="Search..."
                                value={attachmentSearch[attachmentSearch.activeTab || (hasOverlays ? 'overlays' : hasItems ? 'items' : hasObjects ? 'objects' : 'npcs')] || ''}
                                onChange={(e) => {
                                    const activeTab = attachmentSearch.activeTab || (hasOverlays ? 'overlays' : hasItems ? 'items' : hasObjects ? 'objects' : 'npcs');
                                    setAttachmentSearch({ ...attachmentSearch, [activeTab]: e.target.value });
                                }}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0">
                            {(() => {
                                const activeTab = attachmentSearch.activeTab || (hasOverlays ? 'overlays' : hasItems ? 'items' : hasObjects ? 'objects' : 'npcs');
                                
                                if (activeTab === 'overlays' && hasOverlays) {
                                    return (
                                        <AttachmentList
                                            items={finalExtraData?.attachments?.overlays || []}
                                            searchKey="overlays"
                                            search={attachmentSearch}
                                            setSearch={setAttachmentSearch}
                                        />
                                    );
                                }
                                if (activeTab === 'items' && hasItems) {
                                    return (
                                        <AttachmentList
                                            items={finalExtraData?.attachments?.items || []}
                                            searchKey="items"
                                            search={attachmentSearch}
                                            setSearch={setAttachmentSearch}
                                        />
                                    );
                                }
                                if (activeTab === 'objects' && hasObjects) {
                                    return (
                                        <AttachmentList
                                            items={finalExtraData?.attachments?.objects || []}
                                            searchKey="objects"
                                            search={attachmentSearch}
                                            setSearch={setAttachmentSearch}
                                        />
                                    );
                                }
                                if (activeTab === 'npcs' && hasNpcs) {
                                    return (
                                        <AttachmentList
                                            items={finalExtraData?.attachments?.npcs || []}
                                            searchKey="npcs"
                                            search={attachmentSearch}
                                            setSearch={setAttachmentSearch}
                                        />
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    </div>
                ),
            });
        }
        
        return tabs;
    }, [hasTextureData, hasAnyAttachments, finalExtraData, textureId, attachmentSearch, hasOverlays, hasItems, hasObjects, hasNpcs, setAttachmentSearch]);

    // Early returns after all hooks
    if (loading) return <span className="text-muted-foreground text-xs">Loading...</span>;
    if (!fileId) return <span className="text-muted-foreground">-</span>;

    return (
        <RSSprite
            id={fileId}
            width={width}
            height={height}
            rounded={rounded}
            thumbnail={thumbnail}
            saveSprite={saveSprite}
            enableClickModel={enableClickModel}
            gameval={gameval || textureData?.gameval}
            extraData={finalExtraData}
            modalOpen={modalOpen}
            onModalOpenChange={onModalOpenChange}
            showInfoTab={showInfoTab}
            textureId={textureId}
            extraTabs={extraTabs}
            modalTitle={`Texture: ${textureId} [Sprite: ${gameval || textureData?.gameval || ''} (${fileId})]`}
        />
    );
};

export default RSTexture;
