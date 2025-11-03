'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { CacheType, BASE_CACHE_TYPES, LOCALHOST_CACHE_TYPE, STORAGE_KEY, LOCAL_STORAGE_KEY } from '@/lib/cacheTypes';
import { setCacheType } from '@/lib/api/apiClient';
import { checkAllCacheStatuses, checkCacheStatus } from '@/lib/cacheStatus';
import { IconTimezone } from '@tabler/icons-react';

interface CacheTypeContextType {
  selectedCacheType: CacheType;
  setSelectedCacheType: (cacheType: CacheType) => void;
  availableCacheTypes: CacheType[];
  cacheStatuses: Map<string, boolean> | null;
  checkingStatuses: Set<string>;
  refreshStatuses: () => Promise<void>;
}

const CacheTypeContext = createContext<CacheTypeContextType | undefined>(undefined);

export function CacheTypeProvider({ children }: { children: React.ReactNode }) {
  // Check if we're in local environment (development mode, localhost, or has NEXT_PUBLIC_IS_LOCAL)
  // This typically indicates .env.local exists when running in dev mode
  const isLocalEnv = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      process.env.NEXT_PUBLIC_IS_LOCAL === 'true' || 
      process.env.NODE_ENV === 'development' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
  }, []);

  // Build available cache types - include localhost if in local env
  const availableCacheTypes = useMemo(() => {
    const localhostCacheType: CacheType = {
      ...LOCALHOST_CACHE_TYPE,
      icon: <IconTimezone size={24} />,
    };
    return isLocalEnv 
      ? [localhostCacheType, ...BASE_CACHE_TYPES]
      : BASE_CACHE_TYPES;
  }, [isLocalEnv]);

  const [selectedCacheType, setSelectedCacheTypeState] = useState<CacheType>(availableCacheTypes[0]);
  const [cacheStatuses, setCacheStatuses] = useState<Map<string, boolean> | null>(null);
  const [checkingStatuses, setCheckingStatuses] = useState<Set<string>>(new Set());

  // Load selected cache type from localStorage on mount FIRST
  useEffect(() => {
    const manuallySelected = localStorage.getItem(LOCAL_STORAGE_KEY) === 'true';
    const savedCacheTypeId = localStorage.getItem(STORAGE_KEY);

    let selectedType: CacheType;

    // If in local env and user hasn't manually selected, ALWAYS default to localhost
    // This overrides any cached selection unless user manually changed it
    if (isLocalEnv && !manuallySelected) {
      selectedType = {
        ...LOCALHOST_CACHE_TYPE,
        icon: <IconTimezone size={24} />,
      };
      localStorage.setItem(STORAGE_KEY, LOCALHOST_CACHE_TYPE.id);
    } else if (savedCacheTypeId) {
      // Try to load saved selection if available in current list
      const cacheType = availableCacheTypes.find(ct => ct.id === savedCacheTypeId);
      if (cacheType) {
        selectedType = cacheType;
      } else {
        // Fallback to first available
        selectedType = availableCacheTypes[0];
        localStorage.setItem(STORAGE_KEY, availableCacheTypes[0].id);
      }
    } else {
      // Fallback to first available
      selectedType = availableCacheTypes[0];
      localStorage.setItem(STORAGE_KEY, availableCacheTypes[0].id);
    }

    setSelectedCacheTypeState(selectedType);
    setCacheType(selectedType); // Sync with API client

    // Now check the selected cache type first (priority check)
    const otherCacheTypes = availableCacheTypes.filter(ct => ct.id !== selectedType.id);
    setCheckingStatuses(new Set([selectedType.id, ...otherCacheTypes.map(ct => ct.id)]));
    
    // Check priority cache type first
    checkCacheStatus(selectedType).then((isOnline) => {
      setCacheStatuses(prev => {
        const newMap = new Map(prev || []);
        newMap.set(selectedType.id, isOnline);
        return newMap;
      });
      setCheckingStatuses(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedType.id);
        return newSet;
      });
    });

    // Then check others in background
    Promise.allSettled(
      otherCacheTypes.map(async (cacheType) => {
        const isOnline = await checkCacheStatus(cacheType);
        setCacheStatuses(prev => {
          const newMap = new Map(prev || []);
          newMap.set(cacheType.id, isOnline);
          return newMap;
        });
        setCheckingStatuses(prev => {
          const newSet = new Set(prev);
          newSet.delete(cacheType.id);
          return newSet;
        });
      })
    );
  }, [isLocalEnv, availableCacheTypes]);

  // Check cache statuses on mount and periodically
  const refreshStatuses = React.useCallback(async () => {
    setCheckingStatuses(new Set(availableCacheTypes.map(ct => ct.id)));
    const statusMap = await checkAllCacheStatuses(availableCacheTypes);
    setCacheStatuses(statusMap);
    setCheckingStatuses(new Set());
  }, [availableCacheTypes]);

  useEffect(() => {
    // Only auto-refresh if the selected cache is online
    // If offline, stop checking until manual refresh
    const isSelectedOnline = cacheStatuses?.get(selectedCacheType.id) ?? true;
    
    if (!isSelectedOnline || cacheStatuses === null) {
      // Selected cache is offline or still checking - don't auto-refresh
      return;
    }

    // Refresh statuses every 30 seconds when cache is online
    const interval = setInterval(() => {
      refreshStatuses();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshStatuses, selectedCacheType, cacheStatuses]);

  // Save selected cache type to localStorage whenever it changes
  const setSelectedCacheType = (cacheType: CacheType) => {
    setSelectedCacheTypeState(cacheType);
    localStorage.setItem(STORAGE_KEY, cacheType.id);
    localStorage.setItem(LOCAL_STORAGE_KEY, 'true'); // Mark as manually selected
    setCacheType(cacheType); // Sync with API client
  };

  return (
    <CacheTypeContext.Provider value={{ 
      selectedCacheType, 
      setSelectedCacheType,
      availableCacheTypes,
      cacheStatuses,
      checkingStatuses,
      refreshStatuses
    }}>
      {children}
    </CacheTypeContext.Provider>
  );
}

export function useCacheType() {
  const context = useContext(CacheTypeContext);
  if (context === undefined) {
    throw new Error('useCacheType must be used within a CacheTypeProvider');
  }
  return context;
}

