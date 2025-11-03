'use client';

import React from 'react';
import { useCacheType } from '@/components/layout/cache-type-provider';
import { Card, CardContent } from '@/components/ui/card';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

export function CacheStatusBanner() {
  const { selectedCacheType, cacheStatuses, refreshStatuses, checkingStatuses } = useCacheType();
  const isOnline = cacheStatuses?.get(selectedCacheType.id) ?? true;
  const isChecking = checkingStatuses.has(selectedCacheType.id);

  if (isOnline || cacheStatuses === null) {
    return null;
  }

  const handleRefresh = async () => {
    await refreshStatuses();
  };

  return (
    <Card className="border-destructive bg-destructive/10 mb-4">
      <CardContent className="flex items-center gap-3 p-4">
        <IconAlertCircle className="text-destructive flex-shrink-0" size={20} />
        <div className="flex-1">
          <div className="font-semibold text-destructive mb-1">Cache Server Unavailable</div>
          <div className="text-sm">
            The selected cache type <strong>"{selectedCacheType.name}"</strong> is currently offline.
            <br />
            Please select a different cache type from the sidebar.
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isChecking}
          variant="outline"
          size="sm"
          className="flex-shrink-0"
        >
          <IconRefresh size={16} className={isChecking ? 'animate-spin' : ''} />
          <span className="ml-2">Refresh</span>
        </Button>
      </CardContent>
    </Card>
  );
}

