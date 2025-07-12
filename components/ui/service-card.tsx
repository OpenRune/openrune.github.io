import React, { useState } from "react";
import {
    IconBrandSpotify,
    IconBrandApple,
    IconBrandYoutube,
    IconBrandTidal,
    IconUnlink
} from "@tabler/icons-react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { buildUrl } from '@/lib/api/apiClient';
import { authorized } from '@/lib/api/apiClient';
import type { SpotifyAccount } from '@/lib/api/types';
import {Badge} from "lucide-react";

export const serviceIcons = [
    { key: "hasSpotify", label: "Spotify", icon: <IconBrandSpotify className="text-green-500" /> },
    { key: "hasApple", label: "Apple Music", icon: <IconBrandApple className="text-gray-500" /> },
    { key: "hasYoutube", label: "YouTube", icon: <IconBrandYoutube className="text-red-500" /> },
    { key: "hasTidal", label: "Tidal", icon: <IconBrandTidal className="text-blue-500" /> },
];

interface ServiceCardProps {
    service: {
        key: string;
        label: string;
        icon: React.ReactNode;
    };
    isConnected: boolean;
    userAccount: any;
    spotifyAccountData?: SpotifyAccount | null;
    spotifyError?: any;
    onUnlink?: () => Promise<void>;
}

export function ServiceCard({ 
    service, 
    isConnected, 
    userAccount, 
    spotifyAccountData, 
    spotifyError,
    onUnlink 
}: ServiceCardProps) {
    const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
    const [isUnlinking, setIsUnlinking] = useState(false);

    const isSpotify = service.key === 'hasSpotify';
    const spotifyAuthUrl = isSpotify && userAccount && (userAccount as any).profileUrl
        ? (userAccount as any).profileUrl
        : buildUrl('/link/spotify');
    const spotifyProfileUrl = isSpotify && spotifyAccountData 
        ? `https://open.spotify.com/user/${spotifyAccountData.id}` 
        : undefined;

    async function handleUnlinkSpotify() {
        if (!onUnlink) return;
        setIsUnlinking(true);
        try {
            await onUnlink();
        } finally {
            setShowUnlinkDialog(false);
            setIsUnlinking(false);
            window.location.reload();
        }
    }

    return (
        <Card className="w-full min-w-[180px] min-h-[150px] h-full min-w-0 p-2 relative">
            {(isSpotify && isConnected && (spotifyAccountData === null || spotifyError)) ? (
                <div className="flex flex-col items-center w-full p-4">
                    <Skeleton className="w-14 h-14 rounded-full mb-2" />
                    <Skeleton className="w-24 h-4 mb-1" />
                    <Skeleton className="w-16 h-3" />
                </div>
            ) : (
                <>
                    {isSpotify && isConnected && (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button 
                                        className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" 
                                        onClick={() => setShowUnlinkDialog(true)}
                                    >
                                        <IconUnlink size={20} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="left" align="center">
                                    Unlink your Spotify account
                                </TooltipContent>
                            </Tooltip>
                            <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Unlink Spotify?</DialogTitle>
                                        <DialogDescription>
                                            Are you sure you want to unlink your Spotify account? This cannot be undone.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex gap-4 mt-4">
                                        <Button 
                                            variant="outline" 
                                            onClick={() => setShowUnlinkDialog(false)} 
                                            disabled={isUnlinking}
                                        >
                                            Cancel
                                        </Button>
                                        <Button 
                                            variant="destructive" 
                                            onClick={handleUnlinkSpotify} 
                                            disabled={isUnlinking}
                                        >
                                            {isUnlinking ? 'Unlinking...' : 'Unlink'}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}
                    <div className="flex flex-col items-center w-full">
                        <div className="flex items-center justify-center h-10 w-10 mx-auto">
                            {service.icon}
                        </div>
                        <CardHeader className="p-0 pb-1 w-full flex flex-col items-center">
                            <CardTitle className="text-lg">{service.label}</CardTitle>
                            {isConnected && (spotifyAccountData as SpotifyAccount)?.images?.[0]?.url ? (
                                <img 
                                    src={(spotifyAccountData as SpotifyAccount)?.images?.[0]?.url} 
                                    alt="Spotify profile" 
                                    className="rounded-full w-14 h-14 object-cover my-2 border" 
                                />
                            ) : null}
                            <CardDescription>
                                {isConnected ? (
                                    <span>{(spotifyAccountData as SpotifyAccount)?.displayName || 'Connected'}</span>
                                ) : 'Not Connected'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className={`p-0 pt-1 break-words w-full ${isSpotify && isConnected ? '' : (isConnected ? 'flex gap-2' : 'flex flex-col objects-center w-full')}`}>
                            <div className="flex flex-col gap-2 mt-2 w-full">
                                {isConnected ? (
                                    isSpotify ? (
                                        spotifyProfileUrl && (
                                            <Button asChild size="sm" variant="secondary" className="w-full">
                                                <a href={spotifyProfileUrl} target="_blank" rel="noopener noreferrer">View Profile</a>
                                            </Button>
                                        )
                                    ) : (
                                        <>
                                            <Button size="sm" variant="outline" className="w-full">Unlink</Button>
                                            <Button size="sm" variant="secondary" className="w-full">View Profile</Button>
                                        </>
                                    )
                                ) : (
                                    isSpotify ? (
                                        <Button asChild size="sm" variant="outline" className="w-full">
                                            <a href={spotifyAuthUrl}>Connect</a>
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" disabled className="w-full">
                                            Coming Soon
                                        </Button>
                                    )
                                )}
                            </div>
                        </CardContent>
                    </div>
                </>
            )}
        </Card>
    );
} 