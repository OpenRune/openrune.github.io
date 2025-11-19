'use client';

import { useEffect, useState, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { CacheStatusBanner } from '@/components/ui/cache-status-banner';
import { CacheTypeSelectorPage } from '@/components/ui/cache-type-selector-page';
import { useCacheType } from '@/components/layout/cache-type-provider';
import { ServerStatus } from '@/lib/cacheStatus';
import { isPageUsableOffline } from '@/lib/navConfig';

// Pages that should bypass the cache status check
const BYPASS_PAGES = ['/sse'];
// Delay before showing selector page when connection is lost (40 seconds)
const CONNECTION_LOST_DELAY_MS = 40000;

export function CacheStatusWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { selectedCacheType, cacheStatuses, setIsSelectorPageVisible, isModalOpen } = useCacheType();
  const statusInfo = cacheStatuses?.get(selectedCacheType.id);
  const statusResponse = statusInfo?.statusResponse;
  const isChecking = cacheStatuses === null; // Still checking initial status
  const isOnline = statusInfo?.isOnline ?? false;
  
  // Track when connection was lost
  const connectionLostTimeRef = useRef<number | null>(null);
  const [shouldShowSelector, setShouldShowSelector] = useState(false);
  const delayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Allow bypass pages to render directly
  const shouldBypass = BYPASS_PAGES.includes(pathname);
  
  // Check if current page is marked as usable offline in nav config
  const canUseOffline = isPageUsableOffline(pathname);

  // Track connection status and implement delay
  useEffect(() => {
    const isCurrentlyOffline = !isChecking && (!statusResponse || statusResponse.status !== ServerStatus.LIVE);
    
    if (isCurrentlyOffline && !isOnline) {
      // Connection is lost
      if (connectionLostTimeRef.current === null) {
        // First time detecting connection loss - start timer
        connectionLostTimeRef.current = Date.now();
        setShouldShowSelector(false);
        
        // Clear any existing timer
        if (delayTimerRef.current) {
          clearTimeout(delayTimerRef.current);
        }
        
        // Set timer to show selector after delay
        delayTimerRef.current = setTimeout(() => {
          setShouldShowSelector(true);
        }, CONNECTION_LOST_DELAY_MS);
      }
    } else {
      // Connection is back or checking
      // Reset connection lost time
      connectionLostTimeRef.current = null;
      setShouldShowSelector(false);
      
      // Clear delay timer
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
    };
  }, [isChecking, statusResponse, isOnline]);

  // Determine if selector page should be shown
  // BUT: Don't show selector page if modal is open - let the modal overlay on the current page
  // Also don't show if page can be used offline
  // Only show if we've waited the delay period
  const showSelectorPage = shouldShowSelector && !isModalOpen && !canUseOffline;

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
