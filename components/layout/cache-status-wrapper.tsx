'use client';

import React from 'react';
import { CacheStatusBanner } from '@/components/ui/cache-status-banner';
import { CacheTypeSelectorPage } from '@/components/ui/cache-type-selector-page';
import { useCacheType } from '@/components/layout/cache-type-provider';

export function CacheStatusWrapper({ children }: { children: React.ReactNode }) {
  const { selectedCacheType, cacheStatuses } = useCacheType();
  const isOnline = cacheStatuses?.get(selectedCacheType.id) ?? true;
  const isChecking = cacheStatuses === null; // Still checking initial status

  // If checking, show loading state. If offline, show selector page
  if (isChecking) {
    return <CacheStatusBanner />; // Show banner while checking
  }

  if (isOnline === false) {
    // Selected cache is offline - show selector page instead of content
    return (
      <>
        <CacheStatusBanner />
        <CacheTypeSelectorPage />
      </>
    );
  }

  // Cache is online, show normal content
  return (
    <>
      <CacheStatusBanner />
      {children}
    </>
  );
}

