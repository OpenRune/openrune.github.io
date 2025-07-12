import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import React, { useState } from 'react';

export interface UserAccountProps {
  className?: string;
  showInfo?: boolean;
  username?: string;
  profilePicture?: string;
  hasSpotify?: boolean;
  hasApple?: boolean;
  hasYoutube?: boolean;
  hasTidal?: boolean;
  // Add more optional fields if needed
}

export function UserAvatarProfile({
                                       className,
                                       showInfo = false,
                                       username,
                                       profilePicture,
                                   }: UserAccountProps) {
    const [isLoading, setIsLoading] = useState(!!profilePicture);
    const showSkeleton = isLoading && !!profilePicture;
    const showFallback = !profilePicture && !isLoading;

    // Add timeout fallback for loading profile picture
    React.useEffect(() => {
        if (!profilePicture) return;
        setIsLoading(true);
        const timeout = setTimeout(() => {
            setIsLoading(false);
        }, 3000); // 3 seconds
        return () => clearTimeout(timeout);
    }, [profilePicture]);

    return (
        <div className='flex items-center gap-2'>
            <Avatar className={className}>
                <AvatarImage
                    src={profilePicture || ''}
                    alt={username || ''}
                    style={showSkeleton ? { display: 'none' } : {}}
                    onLoad={() => setIsLoading(false)}
                    onError={() => setIsLoading(false)}
                />
                {showSkeleton && (
                    <Skeleton className="h-full w-full rounded-lg absolute" />
                )}
                {(!profilePicture || !isLoading) && (
                    <AvatarFallback className='rounded-lg'>
                        {username?.slice(0, 2)?.toUpperCase() || 'CN'}
                    </AvatarFallback>
                )}
            </Avatar>

            {showInfo && (
                <div className='grid flex-1 text-left text-sm leading-tight'>
                    <span className='truncate font-semibold'>{username || ''}</span>
                </div>
            )}
        </div>
    );
}
