'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  CacheType,
  BASE_CACHE_TYPES,
  LOCALHOST_CACHE_TYPE,
  STORAGE_KEY,
  LOCAL_STORAGE_KEY,
} from '@/lib/cacheTypes';
import { setCacheType } from '@/lib/api/apiClient';
import {
  StatusResponse,
  ServerStatus,
  isStatusOnline,
} from '@/lib/cacheStatus';
import { IconTimezone } from '@tabler/icons-react';
import { fetchSSE, SseConnection } from '@/lib/sse/fetchSSE';
import { SseEventType, StatusResponse as SseStatusResponse } from '@/lib/sse/types';

interface CacheStatusInfo {
  statusResponse: StatusResponse | null;
  isOnline: boolean;
}

interface CacheTypeContextType {
  selectedCacheType: CacheType;
  setSelectedCacheType: (cacheType: CacheType) => void;
  availableCacheTypes: CacheType[];
  cacheStatuses: Map<string, CacheStatusInfo> | null;
  checkingStatuses: Set<string>;
  refreshStatuses: () => Promise<void>; // Manual refresh button if needed
  setIsSelectorPageVisible: (visible: boolean) => void;
  setIsModalOpen: (open: boolean) => void;
  isSelectorPageVisible: boolean;
  isModalOpen: boolean;
  isFirstLoad: boolean;
}

const CacheTypeContext = createContext<CacheTypeContextType | undefined>(
  undefined
);

export function CacheTypeProvider({ children }: { children: React.ReactNode }) {
  const isLocalEnv = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      process.env.NEXT_PUBLIC_IS_LOCAL === 'true' ||
      process.env.NODE_ENV === 'development' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
  }, []);

  const availableCacheTypes = useMemo(() => {
    const localhostCacheType: CacheType = {
      ...LOCALHOST_CACHE_TYPE,
      icon: <IconTimezone size={24} />,
    };
    return isLocalEnv
      ? [localhostCacheType, ...BASE_CACHE_TYPES]
      : BASE_CACHE_TYPES;
  }, [isLocalEnv]);

  const [selectedCacheType, setSelectedCacheTypeState] = useState<CacheType>(
    availableCacheTypes[0]
  );
  const [cacheStatuses, setCacheStatuses] =
    useState<Map<string, CacheStatusInfo> | null>(null);
  const [checkingStatuses, setCheckingStatuses] = useState<Set<string>>(
    new Set()
  );


  const [isSelectorPageVisible, setIsSelectorPageVisibleState] =
    useState(false);
  const [isModalOpen, setIsModalOpenState] = useState(false);
  const [isFirstLoad, setIsFirstLoadState] = useState(true);

  // Separate SSE connections for each cache type
  const sseConnectionsRef = useRef<Map<string, SseConnection>>(new Map());
  const selectedSseConnectionRef = useRef<SseConnection | null>(null);
  const reconnectTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const selectedReconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateCacheStatus = (
    cacheTypeId: string,
    statusResponse: StatusResponse | null
  ) => {
    setCacheStatuses((prev) => {
      const newMap = new Map(prev || []);
      const isOnline = statusResponse
        ? isStatusOnline(statusResponse.status)
        : false;
      newMap.set(cacheTypeId, { statusResponse, isOnline });
      return newMap;
    });
  };

  // Mark all cache types as offline
  const markAllAsOffline = React.useCallback(() => {
    const offlineMap = new Map<string, CacheStatusInfo>();
    availableCacheTypes.forEach((cacheType) => {
      offlineMap.set(cacheType.id, {
        statusResponse: null,
        isOnline: false,
      });
    });
    setCacheStatuses(offlineMap);
    setIsFirstLoadState(false);
    setCheckingStatuses(new Set());
  }, [availableCacheTypes]);

  // Helper to find cache type by port (SSE events include port but may not include IP)
  const findCacheTypeByPort = React.useCallback((port: number): CacheType | undefined => {
    return availableCacheTypes.find(ct => ct.port === port);
  }, [availableCacheTypes]);

  // Convert SSE StatusResponse to cacheStatus StatusResponse
  const convertSseStatusResponse = React.useCallback((sseResponse: SseStatusResponse): StatusResponse => {
    return {
      status: sseResponse.status as ServerStatus,
      game: sseResponse.game,
      revision: sseResponse.revision,
      environment: sseResponse.environment,
      port: sseResponse.port,
      statusMessage: sseResponse.statusMessage ?? null,
      progress: sseResponse.progress ?? null,
    };
  }, []);

  // Handle SSE status update
  const handleSSEStatusUpdate = React.useCallback((sseStatusResponse: SseStatusResponse) => {
    
    // Find the cache type by port (SSE events include port number)
    const matchedCacheType = findCacheTypeByPort(sseStatusResponse.port);
    
    if (matchedCacheType) {
      // Convert SSE response to our StatusResponse format
      const statusResponse = convertSseStatusResponse(sseStatusResponse);
      
      // Update the cache status
      updateCacheStatus(matchedCacheType.id, statusResponse);
      
      // Remove from checking status
      setCheckingStatuses(prev => {
        const newSet = new Set(prev);
        newSet.delete(matchedCacheType.id);
        return newSet;
      });
    }
  }, [findCacheTypeByPort, convertSseStatusResponse, updateCacheStatus]);

  // Helper function to log active SSE connections
  const logActiveConnections = React.useCallback(() => {
    const activeConnections: string[] = [];
    
    // Log standard connections
    sseConnectionsRef.current.forEach((connection, key) => {
      const state = connection.readyState();
      const stateText = state === EventSource.CONNECTING ? 'CONNECTING' : state === EventSource.OPEN ? 'OPEN' : 'CLOSED';
      activeConnections.push(`${key} (${stateText})`);
    });
    
    // Log selected connection
    if (selectedSseConnectionRef.current) {
      const state = selectedSseConnectionRef.current.readyState();
      const stateText = state === EventSource.CONNECTING ? 'CONNECTING' : state === EventSource.OPEN ? 'OPEN' : 'CLOSED';
      activeConnections.push(`SELECTED (${stateText})`);
    }
    
    if (activeConnections.length > 0) {
      console.log(`[CacheTypeProvider] 🔌 Active SSE Connections (${activeConnections.length}):`, activeConnections);
    } else {
      console.log(`[CacheTypeProvider] 🔌 Active SSE Connections: NONE`);
    }
  }, []);

  // Setup SSE connection for a specific cache type
  const setupSSEForCacheType = React.useCallback((cacheType: CacheType, isSelected: boolean = false) => {
    const backendUrl = `http://${cacheType.ip}:${cacheType.port}`;
    const connectionKey = isSelected ? `selected-${cacheType.id}` : cacheType.id;
    
    // Clear any existing reconnection timer for this connection
    if (isSelected) {
      if (selectedReconnectTimerRef.current) {
        clearTimeout(selectedReconnectTimerRef.current);
        selectedReconnectTimerRef.current = null;
      }
    } else {
      const existingTimer = reconnectTimersRef.current.get(connectionKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        reconnectTimersRef.current.delete(connectionKey);
      }
    }
    
    // Close existing connection if any
    const existingConnection = isSelected 
      ? selectedSseConnectionRef.current 
      : sseConnectionsRef.current.get(connectionKey);
    
    if (existingConnection) {
      existingConnection.close();
      if (isSelected) {
        selectedSseConnectionRef.current = null;
      } else {
        sseConnectionsRef.current.delete(connectionKey);
      }
      logActiveConnections();
    }
    
    const connection = fetchSSE(
      SseEventType.STATUS,
      (data: SseStatusResponse) => {
        logActiveConnections();
        
        // Since each cache type has its own connection, we know this event is for this cache type
        // But verify by port to be safe
        if (data.port === cacheType.port) {
          // Convert SSE response to our StatusResponse format
          const statusResponse: StatusResponse = {
            status: data.status as ServerStatus,
            game: data.game,
            revision: data.revision,
            environment: data.environment,
            port: data.port,
            statusMessage: data.statusMessage ?? null,
            progress: data.progress ?? null,
          };
          
          // Update the cache status for this specific cache type
          setCacheStatuses((prev) => {
            const newMap = new Map(prev || []);
            const isOnline = statusResponse ? isStatusOnline(statusResponse.status) : false;
            newMap.set(cacheType.id, { statusResponse, isOnline });
            return newMap;
          });
          
          // Remove from checking status
          setCheckingStatuses((prev) => {
            const newSet = new Set(prev);
            newSet.delete(cacheType.id);
            return newSet;
          });
        }
      },
      (error) => {
        logActiveConnections();
        
        // Check if this connection should still be active
        const shouldListenToAll = isSelectorPageVisible || isModalOpen;
        if (!isSelected && !shouldListenToAll) {
          return; // Don't reconnect if we're not supposed to be listening
        }
        
        // Mark this specific cache type as offline
        setCacheStatuses((prev) => {
          const newMap = new Map(prev || []);
          newMap.set(cacheType.id, { statusResponse: null, isOnline: false });
          return newMap;
        });
        
        // Only reconnect if this connection should be active
        const timerId = setTimeout(() => {
          // Check again if we should reconnect
          const currentShouldListen = isSelectorPageVisible || isModalOpen;
          if (!isSelected && !currentShouldListen) {
            return;
          }
          setupSSEForCacheType(cacheType, isSelected);
        }, 5000);
        
        if (isSelected) {
          selectedReconnectTimerRef.current = timerId;
        } else {
          reconnectTimersRef.current.set(connectionKey, timerId);
        }
      },
      () => {
        logActiveConnections();
      },
      backendUrl
    );

    if (connection) {
      if (isSelected) {
        selectedSseConnectionRef.current = connection;
      } else {
        sseConnectionsRef.current.set(connectionKey, connection);
      }
      logActiveConnections();
    } else {
      // Mark as offline
      setCacheStatuses((prev) => {
        const newMap = new Map(prev || []);
        newMap.set(cacheType.id, { statusResponse: null, isOnline: false });
        return newMap;
      });
      logActiveConnections();
    }
  }, [logActiveConnections, isSelectorPageVisible, isModalOpen]);

  // Always setup SSE connection for selected cache type
  useEffect(() => {
    // Setup connection for selected cache type (always active)
    setupSSEForCacheType(selectedCacheType, true);

    // Cleanup when selected changes
    return () => {
      if (selectedSseConnectionRef.current) {
        selectedSseConnectionRef.current.close();
        selectedSseConnectionRef.current = null;
        logActiveConnections();
      }
    };
  }, [selectedCacheType, setupSSEForCacheType, logActiveConnections]);

  // Helper function to cleanup extra connections (keep only selected)
  const cleanupExtraConnections = React.useCallback(() => {
    const shouldListenToAll = isSelectorPageVisible || isModalOpen;
    
    if (!shouldListenToAll && sseConnectionsRef.current.size > 0) {
      // Clear all reconnection timers first
      reconnectTimersRef.current.forEach((timer) => {
        clearTimeout(timer);
      });
      reconnectTimersRef.current.clear();
      
      sseConnectionsRef.current.forEach((connection) => {
        connection.close();
      });
      sseConnectionsRef.current.clear();
      logActiveConnections();
    }
  }, [isSelectorPageVisible, isModalOpen, logActiveConnections]);

  // Setup SSE connections for all cache types ONLY when selector page or modal is open
  useEffect(() => {
    const shouldListenToAll = isSelectorPageVisible || isModalOpen;
    
    if (shouldListenToAll) {
      // Mark all as offline initially when opening
      markAllAsOffline();
      
      // Setup SSE connection for each cache type
      // Include ALL cache types (including selected) - selected will have 2 connections (selected + standard)
      // This gives faster updates when modal/page is open
      availableCacheTypes.forEach((cacheType) => {
        setupSSEForCacheType(cacheType, false);
      });
      
      logActiveConnections();
    } else {
      // Clear all reconnection timers first
      reconnectTimersRef.current.forEach((timer) => {
        clearTimeout(timer);
      });
      reconnectTimersRef.current.clear();
      
      // Close all cache type connections (but keep selected connection)
      if (sseConnectionsRef.current.size > 0) {
        sseConnectionsRef.current.forEach((connection) => {
          connection.close();
        });
        sseConnectionsRef.current.clear();
      }
      logActiveConnections();
    }

    // Cleanup when dependencies change
    return () => {
      if (!shouldListenToAll) {
        // Only cleanup if we're closing (connections already closed above)
        return;
      }
      
      sseConnectionsRef.current.forEach((connection) => {
        connection.close();
      });
      sseConnectionsRef.current.clear();
      logActiveConnections();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectorPageVisible, isModalOpen, selectedCacheType.id, setupSSEForCacheType, logActiveConnections]); // Run when selector page/modal state changes

  // Periodic check to ensure only selected connection is active when modal/page is closed
  useEffect(() => {
    // Check every 2 seconds if connections need to be cleaned up
    const intervalId = setInterval(() => {
      const shouldListenToAll = isSelectorPageVisible || isModalOpen;
      const currentConnections = sseConnectionsRef.current.size;
      
      if (!shouldListenToAll && currentConnections > 0) {
        cleanupExtraConnections();
      } else if (shouldListenToAll && currentConnections === 0 && availableCacheTypes.length > 0) {
        // If we should be listening but have no connections, set them up
        availableCacheTypes.forEach((cacheType) => {
          setupSSEForCacheType(cacheType, false);
        });
        logActiveConnections();
      }
    }, 2000); // Check every 2 seconds

    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectorPageVisible, isModalOpen, cleanupExtraConnections]);

  // Initial cleanup on unmount (close everything)
  useEffect(() => {
    return () => {
      // Clear all reconnection timers
      reconnectTimersRef.current.forEach((timer) => {
        clearTimeout(timer);
      });
      reconnectTimersRef.current.clear();
      
      if (selectedReconnectTimerRef.current) {
        clearTimeout(selectedReconnectTimerRef.current);
        selectedReconnectTimerRef.current = null;
      }
      
      // Close all cache type connections
      sseConnectionsRef.current.forEach((connection) => {
        connection.close();
      });
      sseConnectionsRef.current.clear();
      
      // Close selected connection
      if (selectedSseConnectionRef.current) {
        selectedSseConnectionRef.current.close();
        selectedSseConnectionRef.current = null;
      }
    };
  }, []); // Only on unmount

  // Load selected cache type from localStorage
  useEffect(() => {
    const manuallySelected = localStorage.getItem(LOCAL_STORAGE_KEY) === 'true';
    const savedCacheTypeId = localStorage.getItem(STORAGE_KEY);

    let selectedType: CacheType;

    if (isLocalEnv && !manuallySelected) {
      selectedType = { ...LOCALHOST_CACHE_TYPE, icon: <IconTimezone size={24} /> };
      localStorage.setItem(STORAGE_KEY, LOCALHOST_CACHE_TYPE.id);
    } else if (savedCacheTypeId) {
      const cacheType = availableCacheTypes.find(
        (ct) => ct.id === savedCacheTypeId
      );
      if (cacheType) selectedType = cacheType;
      else {
        selectedType = availableCacheTypes[0];
        localStorage.setItem(STORAGE_KEY, availableCacheTypes[0].id);
      }
    } else {
      selectedType = availableCacheTypes[0];
      localStorage.setItem(STORAGE_KEY, availableCacheTypes[0].id);
    }

    setSelectedCacheTypeState(selectedType);
    setCacheType(selectedType);
    setIsFirstLoadState(false);
  }, [isLocalEnv, availableCacheTypes]);

  const setSelectedCacheType = (cacheType: CacheType) => {
    setSelectedCacheTypeState(cacheType);
    localStorage.setItem(STORAGE_KEY, cacheType.id);
    localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
    setCacheType(cacheType);
  };

  const setIsSelectorPageVisible = React.useCallback((visible: boolean) => {
    setIsSelectorPageVisibleState(visible);
  }, []);

  const setIsModalOpen = React.useCallback((open: boolean) => {
    setIsModalOpenState(open);
  }, []);

  // Expose refreshStatuses for manual refresh (button click, etc.)
  const refreshStatuses = React.useCallback(async () => {
    markAllAsOffline();
  }, [markAllAsOffline]);

  return (
    <CacheTypeContext.Provider
      value={{
        selectedCacheType,
        setSelectedCacheType,
        availableCacheTypes,
        cacheStatuses,
        checkingStatuses,
        refreshStatuses,
        setIsSelectorPageVisible,
        setIsModalOpen,
        isSelectorPageVisible,
        isModalOpen,
        isFirstLoad,
      }}
    >
      {children}
    </CacheTypeContext.Provider>
  );
}

export function useCacheType() {
  const context = useContext(CacheTypeContext);
  if (context === undefined)
    throw new Error('useCacheType must be used within a CacheTypeProvider');
  return context;
}