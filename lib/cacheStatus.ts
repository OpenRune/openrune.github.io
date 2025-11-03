import { CacheType } from './cacheTypes';
import { unauthorizedRequest } from './api/apiClient';

export interface CacheStatus {
  cacheTypeId: string;
  isOnline: boolean;
  lastChecked: number;
}

export async function checkCacheStatus(cacheType: CacheType): Promise<boolean> {
  try {
    // Create a temporary cache type header to check this specific cache
    const cacheTypeHeader = JSON.stringify({ ip: cacheType.ip, port: cacheType.port });
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const response = await unauthorizedRequest<string>({
        method: 'get',
        url: 'public/status',
        responseType: 'text',
        headers: {
          'x-cache-type': cacheTypeHeader,
        },
        timeout: 5000,
        signal: controller.signal,
        validateStatus: (status) => status >= 200 && status < 500, // Don't throw on 2xx-4xx
      });

      clearTimeout(timeoutId);

      // Handle connection errors (503, 502) - cache is unavailable
      if (response.status === 503 || response.status === 502) {
        return false;
      }

      // If we get a successful status code (200-299), service is online
      if (response.status >= 200 && response.status < 300) {
        // Status code 200 OK is sufficient - service is online
        // Also check response body if available (may contain "OK" or "ok")
        const data = response.data || '';
        // If status is 200, return true regardless of body
        // For other 2xx codes, also check if body contains "ok" if needed
        return true;
      }

      // Any other status code means offline
      return false;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      // Silently handle timeout/connection errors - services can be down
      
      // Check if it's an abort error or timeout
      if (controller.signal.aborted || fetchError?.code === 'ECONNABORTED' || fetchError?.message?.includes('timeout')) {
        return false;
      }
      
      // For axios errors with response, check status codes
      // Axios throws errors for non-2xx status codes, but we can check the response
      if (fetchError?.response) {
        const status = fetchError.response.status;
        // If we got a 200 response but axios still threw, something else is wrong
        if (status === 200) {
          return true; // Got 200, consider it online
        }
        if (status === 503 || status === 502) {
          return false;
        }
      }
      
      // For any other error, consider it offline
      return false;
    }
  } catch (error) {
    // Silently handle errors - services can be down
    return false;
  }
}

// Helper function to limit concurrency
async function limitConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const promise = fn(item).then(() => {
      executing.splice(executing.indexOf(promise), 1);
    });
    executing.push(promise);
    
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
}

export async function checkAllCacheStatuses(cacheTypes: CacheType[]): Promise<Map<string, boolean>> {
  const statusMap = new Map<string, boolean>();
  
  // Check cache types with concurrency limit (2 at a time)
  await limitConcurrency(cacheTypes, 2, async (cacheType) => {
    const isOnline = await checkCacheStatus(cacheType);
    statusMap.set(cacheType.id, isOnline);
  });

  return statusMap;
}

export async function checkCacheStatusPriority(
  priorityCacheType: CacheType,
  otherCacheTypes: CacheType[]
): Promise<Map<string, boolean>> {
  const statusMap = new Map<string, boolean>();
  
  // Check priority cache type first
  const priorityStatus = await checkCacheStatus(priorityCacheType);
  statusMap.set(priorityCacheType.id, priorityStatus);
  
  // Then check others in background (don't await)
  Promise.allSettled(
    otherCacheTypes.map(async (cacheType) => {
      const isOnline = await checkCacheStatus(cacheType);
      statusMap.set(cacheType.id, isOnline);
      return { id: cacheType.id, isOnline };
    })
  );
  
  return statusMap;
}

