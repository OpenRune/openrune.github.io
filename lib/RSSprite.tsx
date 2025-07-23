import React, { useState, useEffect, MouseEventHandler, useMemo } from "react";
import { buildUrl } from "@/lib/api/apiClient";
import { toast } from "sonner";
import {
    ContextMenu,
    ContextMenuTrigger,
    ContextMenuContent,
    ContextMenuItem,
} from "@/components/ui/context-menu";

interface RSSpriteProps {
    id: number | string;
    width?: number;
    height?: number;
    keepAspectRatio?: boolean;
    rounded?: boolean;
    thumbnail?: boolean;
    onClick?: MouseEventHandler<HTMLImageElement>;
    saveSprite?: boolean;
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
                                           }) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const maxRetries = 3;
    const retryDelay = 2000;

    const spriteUrl = useMemo(() => buildUrl(`/public/sprite/${id}`, {
        width,
        height,
        keepAspectRatio,
    }), [id, width, height, keepAspectRatio]);

    useEffect(() => {
        const cacheKey = `sprite_${id}_${width}_${height}_${keepAspectRatio}`;
        if (saveSprite) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                console.log(`Loaded sprite ${id} from cache`, cached.slice(0, 30));
                setImageSrc(cached);
                setLoading(false);
                setError(null);
                return;
            } else {
                console.log(`No cache for sprite ${id}, fetching...`);
            }
        } else {
            console.log(`Fetching sprite ${id} (not cached)`);
        }

        setLoading(true);
        fetch(spriteUrl)
            .then((response) => {
                if (!response.ok) throw new Error(`Failed to load image from ${spriteUrl}`);
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
        // No need for URL.revokeObjectURL cleanup for data URLs
    }, [id, width, height, keepAspectRatio, retryCount, saveSprite]);

    const copyImageUrl = async () => {
        try {
            await navigator.clipboard.writeText(spriteUrl);
            toast.success("Copied sprite URL");
        } catch {
            toast.error("Failed to copy URL");
        }
    };

    const downloadImage = () => {
        if (!imageSrc) return;
        const link = document.createElement("a");
        link.href = buildUrl(`/public/sprite/${id}`);
        link.download = `sprite-${id}.png`;
        link.click();
    };

    if (error && retryCount >= maxRetries) return <div className="text-red-600">Error loading image</div>;
    if (loading) return <div className="text-gray-500">Loading...</div>;

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <img
                    src={imageSrc ?? undefined}
                    alt={`Sprite ${id}`}
                    onClick={onClick}
                    draggable={false}
                    className={`
            ${rounded ? "rounded-md" : ""}
            ${thumbnail ? "border shadow-sm border-primary" : ""}
            ${onClick ? "cursor-pointer" : "cursor-default"}
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
    );
};

export default RSSprite;
