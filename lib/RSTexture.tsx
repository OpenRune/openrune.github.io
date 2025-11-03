import React, { useState, useEffect } from "react";
import RSSprite from "@/lib/RSSprite";
import { fetchFromBuildUrl } from "@/lib/api/apiClient";

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

    if (loading) return <span className="text-muted-foreground text-xs">Loading...</span>;
    if (!fileId) return <span className="text-muted-foreground">-</span>;

    // Prepare extraData from texture if not provided
    const finalExtraData = extraData || (textureData ? {
        isTransparent: textureData.isTransparent,
        averageRgb: textureData.averageRgb,
        animationDirection: textureData.animationDirection,
        animationSpeed: textureData.animationSpeed,
        spriteCrc: textureData.spriteCrc,
        attachments: textureData.attachments,
    } : undefined);

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
            textureId={textureId} // Pass texture ID for modal title
        />
    );
};

export default RSTexture;

