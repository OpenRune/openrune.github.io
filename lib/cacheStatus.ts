import { CacheType } from './cacheTypes';
import { unauthorizedRequest } from './api/apiClient';

export enum ServerStatus {
  BOOTING = 'BOOTING',
  UPDATING = 'UPDATING',
  LIVE = 'LIVE',
  ERROR = 'ERROR',
}

export interface StatusResponse {
  status: ServerStatus;
  game: string;
  revision: number;
  environment: string;
  port: number;
  statusMessage?: string | null;
  progress?: number | null;
}

export interface CacheStatusInfo {
  status: ServerStatus;
  isOnline: boolean; // LIVE = true, others = false
  statusResponse: StatusResponse | null;
  lastChecked: number;
}

// Helper to determine if server is online based on status
export function isStatusOnline(status: ServerStatus): boolean {
  return status === ServerStatus.LIVE;
}

export async function checkCacheStatus(cacheType: CacheType): Promise<StatusResponse | null> {
  try {
    // Create a temporary cache type header to check this specific cache
    const cacheTypeHeader = JSON.stringify({ ip: cacheType.ip, port: cacheType.port });
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const response = await unauthorizedRequest<StatusResponse>({
        method: 'get',
        url: 'status',
        responseType: 'json',
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
        return null;
      }

      // If we get a successful status code (200-299), return the status response
      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }

      // Any other status code means we couldn't get status
      return null;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Check if it's an abort error or timeout
      if (controller.signal.aborted || fetchError?.code === 'ECONNABORTED' || fetchError?.message?.includes('timeout')) {
        return null;
      }
      
      // For axios errors with response, check status codes
      if (fetchError?.response) {
        const status = fetchError.response.status;
        // If we got a 200 response but axios still threw, something else is wrong
        if (status === 200 && fetchError.response.data) {
          return fetchError.response.data as StatusResponse;
        }
        if (status === 503 || status === 502) {
          return null;
        }
      }
      
      // For any other error, return null
      return null;
    }
  } catch (error) {
    // Silently handle errors - services can be down
    return null;
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

export async function checkAllCacheStatuses(cacheTypes: CacheType[]): Promise<Map<string, StatusResponse | null>> {
  const statusMap = new Map<string, StatusResponse | null>();
  
  // Check cache types with concurrency limit (2 at a time)
  await limitConcurrency(cacheTypes, 2, async (cacheType) => {
    const statusResponse = await checkCacheStatus(cacheType);
    statusMap.set(cacheType.id, statusResponse);
  });

  return statusMap;
}

export async function checkCacheStatusPriority(
  priorityCacheType: CacheType,
  otherCacheTypes: CacheType[]
): Promise<Map<string, StatusResponse | null>> {
  const statusMap = new Map<string, StatusResponse | null>();
  
  // Check priority cache type first
  const priorityStatus = await checkCacheStatus(priorityCacheType);
  statusMap.set(priorityCacheType.id, priorityStatus);
  
  // Then check others in background (don't await)
  Promise.allSettled(
    otherCacheTypes.map(async (cacheType) => {
      const statusResponse = await checkCacheStatus(cacheType);
      statusMap.set(cacheType.id, statusResponse);
      return { id: cacheType.id, statusResponse };
    })
  );
  
  return statusMap;
}
