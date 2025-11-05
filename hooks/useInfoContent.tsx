'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { fetchFromBuildUrl } from '@/lib/api/apiClient';
import { TableInfoContent } from '@/components/ui/table-columns/info-content';

interface UseInfoContentOptions {
  endpoint: string;
  title: string;
  description?: string;
  extraStats?: (info: any) => Array<{ label: string; value: number | undefined }>;
}

// Track fetches across all hook instances to prevent duplicates
const fetchTracker = new Map<string, Promise<any>>();

export function useInfoContent({ endpoint, title, description, extraStats }: UseInfoContentOptions) {
  const [info, setInfo] = useState<any>(null);
  const endpointRef = useRef<string>(endpoint);
  const fetchedRef = useRef<boolean>(false);

  useEffect(() => {
    // Reset if endpoint changed
    if (endpointRef.current !== endpoint) {
      endpointRef.current = endpoint;
      fetchedRef.current = false;
      setInfo(null);
    }

    // Skip if already fetched or currently fetching
    if (fetchedRef.current) return;

    const fetchKey = `${endpoint}/info`;
    
    // Check if there's already a pending fetch for this endpoint
    const existingFetch = fetchTracker.get(fetchKey);
    if (existingFetch) {
      existingFetch.then((data) => {
        if (endpointRef.current === endpoint) {
          setInfo(data);
          fetchedRef.current = true;
        }
      }).catch(() => {
        // Ignore errors, will be handled by the main fetch
      });
      return;
    }

    fetchedRef.current = true;

    const fetchInfo = async () => {
      try {
        const response = await fetchFromBuildUrl(`${endpoint}/info`, {});
        if (response.ok) {
          const data = await response.json();
          fetchTracker.delete(fetchKey); // Remove from tracker on success
          if (endpointRef.current === endpoint) {
            setInfo(data);
          }
          return data;
        } else {
          fetchTracker.delete(fetchKey); // Remove on error too
          fetchedRef.current = false; // Allow retry
        }
      } catch (error) {
        fetchTracker.delete(fetchKey);
        fetchedRef.current = false; // Allow retry
      }
    };

    const fetchPromise = fetchInfo();
    fetchTracker.set(fetchKey, fetchPromise);

    return () => {
      // Cleanup: if component unmounts, don't update state
      // The fetchTracker will still hold the promise for other instances
    };
  }, [endpoint]);

  const infoContent = useMemo(() => {
    if (!info) return null;
    
    const computedExtraStats = extraStats ? extraStats(info) : undefined;
    
    return (
      <TableInfoContent
        title={title}
        stats={info}
        description={description}
        extraStats={computedExtraStats}
      />
    );
  }, [info, title, description, extraStats]);

  return { info, infoContent };
}

