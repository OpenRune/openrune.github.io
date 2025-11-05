'use client';

import React from 'react';
import { useCacheType } from '@/components/layout/cache-type-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { IconAlertCircle, IconCloudDownload, IconLoader2 } from '@tabler/icons-react';
import { ServerStatus } from '@/lib/cacheStatus';

interface CacheStatusBannerProps {
  /** If true, shows a simple static "Server Unavailable" message (used on selector page) */
  staticMode?: boolean;
}

export function CacheStatusBanner({ staticMode = false }: CacheStatusBannerProps = {}) {
  const { selectedCacheType, cacheStatuses, isSelectorPageVisible } = useCacheType();
  const statusInfo = cacheStatuses?.get(selectedCacheType.id);
  const statusResponse = statusInfo?.statusResponse;
  const isOnline = statusInfo?.isOnline ?? false;

  // Auto-detect if we're on the selector page (server unavailable page)
  // If selector page is visible, always show static message
  const showStaticMessage = staticMode || isSelectorPageVisible;

  // Don't show banner if status is LIVE or still initializing (and not in static mode)
  if (!showStaticMessage && ((isOnline && statusResponse?.status === ServerStatus.LIVE) || cacheStatuses === null)) {
    return null;
  }

  // If in static mode (server unavailable page), show simple static message
  if (showStaticMessage) {
    return (
      <Card className="border-red-500/50 bg-red-500/10 mb-4">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex-shrink-0 mt-0.5">
            <IconAlertCircle size={20} className="text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-red-600 dark:text-red-400 mb-2">Server Unavailable</div>
            <div className="text-sm">
              The selected cache server <strong>"{selectedCacheType.name}"</strong> is currently offline or unavailable. 
              Please select a different cache type to continue.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine banner style and content based on status
  let bannerClass = '';
  let icon = <IconAlertCircle size={20} />;
  let title = '';
  let content: React.ReactNode = null;

  if (!statusResponse) {
    // No status response - server is offline/unreachable
    bannerClass = 'border-destructive bg-destructive/10';
    title = 'Cache Server Unavailable';
    content = (
      <>
        <div className="font-semibold text-destructive mb-1">{title}</div>
        <div className="text-sm">
          The selected cache type <strong>"{selectedCacheType.name}"</strong> is currently offline or unreachable.
          <br />
          Please select a different cache type from the sidebar.
        </div>
      </>
    );
  } else {
    switch (statusResponse.status) {
      case ServerStatus.ERROR:
        bannerClass = 'border-destructive bg-destructive/10';
        title = 'Cache Server Error';
        content = (
          <>
            <div className="font-semibold text-destructive mb-1">{title}</div>
            <div className="text-sm">
              <strong>"{selectedCacheType.name}"</strong> encountered an error.
              {statusResponse.statusMessage && (
                <>
                  <br />
                  <span className="font-medium">Error:</span> {statusResponse.statusMessage}
                </>
              )}
              {statusResponse.game && statusResponse.revision && (
                <>
                  <br />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    {statusResponse.game} (Rev {statusResponse.revision})
                  </span>
                </>
              )}
            </div>
          </>
        );
        break;

      case ServerStatus.BOOTING:
        bannerClass = 'border-blue-500/50 bg-blue-500/10';
        icon = <IconLoader2 size={20} className="animate-spin" />;
        title = 'Cache Server Booting';
        content = (
          <>
            <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1">{title}</div>
            <div className="text-sm">
              <strong>"{selectedCacheType.name}"</strong> is currently booting up.
              {statusResponse.game && statusResponse.revision && (
                <>
                  <br />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    {statusResponse.game} (Rev {statusResponse.revision})
                  </span>
                </>
              )}
            </div>
          </>
        );
        break;

      case ServerStatus.UPDATING:
        bannerClass = 'border-blue-500/50 bg-blue-500/10';
        icon = <IconCloudDownload size={20} className="animate-pulse" />;
        title = 'Cache Server Updating';
        const progress = statusResponse.progress ?? 0;
        content = (
          <>
            <div className="font-semibold text-blue-600 dark:text-blue-400 mb-2">{title}</div>
            <div className="text-sm mb-3">
              <strong>"{selectedCacheType.name}"</strong> is updating...
              {statusResponse.statusMessage && (
                <>
                  <br />
                  <span>{statusResponse.statusMessage}</span>
                </>
              )}
              {statusResponse.game && statusResponse.revision && (
                <>
                  <br />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    {statusResponse.game} (Rev {statusResponse.revision})
                  </span>
                </>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </>
        );
        break;

      default:
        return null;
    }
  }

  return (
    <Card className={`${bannerClass} mb-4`}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          {content}
        </div>
      </CardContent>
    </Card>
  );
}
