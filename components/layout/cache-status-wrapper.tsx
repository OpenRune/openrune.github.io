'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { CacheStatusBanner } from '@/components/ui/cache-status-banner';
import { CacheTypeSelectorPage } from '@/components/ui/cache-type-selector-page';
import { useCacheType } from '@/components/layout/cache-type-provider';
import { ServerStatus } from '@/lib/cacheStatus';
import { isPageUsableOffline } from '@/lib/navConfig';

// Pages that should bypass the cache status check
const BYPASS_PAGES = ['/sse'];

export function CacheStatusWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { selectedCacheType, cacheStatuses, setIsSelectorPageVisible, isModalOpen } = useCacheType();
  const statusInfo = cacheStatuses?.get(selectedCacheType.id);
  const statusResponse = statusInfo?.statusResponse;
  const isChecking = cacheStatuses === null; // Still checking initial status

  // Allow bypass pages to render directly
  const shouldBypass = BYPASS_PAGES.includes(pathname);
  
  // Check if current page is marked as usable offline in nav config
  const canUseOffline = isPageUsableOffline(pathname);

  // Determine if selector page should be shown
  // BUT: Don't show selector page if modal is open - let the modal overlay on the current page
  // Also don't show if page can be used offline
  const showSelectorPage = !isChecking && (!statusResponse || statusResponse.status !== ServerStatus.LIVE) && !isModalOpen && !canUseOffline;

  // Notify provider when selector page visibility changes
  useEffect(() => {
    setIsSelectorPageVisible(showSelectorPage && !shouldBypass);
    return () => setIsSelectorPageVisible(false);
  }, [showSelectorPage, shouldBypass, setIsSelectorPageVisible]);

  // Bypass pages render directly without any cache checks
  if (shouldBypass) {
    return <>{children}</>;
  }
  
  // Pages marked as usable offline can render even when server is unavailable
  // Don't show banner on these pages
  if (canUseOffline) {
    return <>{children}</>;
  }

  // If checking, show loading state (banner only). If offline/error/updating/booting, show selector page
  // BUT: If modal is open, show the actual page content instead
  if (isChecking) {
    if (isModalOpen) {
      // Modal is open, show the page content (modal will overlay)
      return <>{children}</>;
    }
    return <CacheStatusBanner />; // Show banner while checking
  }

  // Show selector page if:
  // - No status response (offline/unreachable)
  // - ERROR status
  // - BOOTING status (waiting for it to become LIVE)
  // - UPDATING status (will be polled, but show selector until LIVE)
  // BUT: If modal is open, show the actual page content instead (modal will overlay)
  if (showSelectorPage && !isModalOpen) {
    return (
      <>
        <CacheStatusBanner />
        <CacheTypeSelectorPage />
      </>
    );
  }

  // Cache is LIVE OR modal is open, show normal content (modal can overlay if open)
  return (
    <>
      {!isModalOpen && <CacheStatusBanner />}
      {children}
    </>
  );
}
