/**
 * SSE Event Types - matches Kotlin enum class SseEventType
 */
export enum SseEventType {
  STATUS = 'STATUS',
  ACTIVITY = 'ACTIVITY',
  ZIP_PROGRESS = 'ZIP_PROGRESS',
  // Add more event types here as needed
}

/**
 * StatusResponse - matches Kotlin data class StatusResponse
 */
export interface StatusResponse {
  status: string;
  game: string;
  revision: number;
  environment: string;
  port: number;
  statusMessage?: string | null;
  progress?: number | null;
}

/**
 * SSE Event wrapper - what your backend sends
 */
export interface SseEvent<T = any> {
  type: SseEventType;
  data: T;
}

/**
 * ActivityStats - matches Kotlin ActivityStats data class
 */
export interface ActivityStats {
  queries: QueryStats;
  active: ActiveStats;
  recentActivity: QueryActivity[];
  cacheStats: Record<string, CacheStats>;
}

export interface QueryStats {
  total: number;
  cached: number;
  averageTimeMs: number;
  cachedAverageTimeMs: number;
  maxTimeMs: number;
  cachedMaxTimeMs: number;
}

export interface ActiveStats {
  activeQueries: number;
  currentRequests: ActiveRequestInfo[];
}

export interface ActiveRequestInfo {
  endpoint: string;
  queryParams: string | null;
  durationMs: number;
  isCached: boolean | null;
}

export interface QueryActivity {
  endpoint: string;
  queryParams: string | null;
  cached: boolean;
  durationMs: number;
  timestamp: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  earliestExpirationMs?: number | null;
  latestExpirationMs?: number | null;
}

/**
 * ZipProgressResponse - matches backend ZipProgressResponse
 */
export interface ZipProgressResponse {
  jobId: string;
  type: 'SPRITES' | 'MODELS' | 'TEXTURES';
  progress: number; // 0-100
  message: string;
  downloadUrl: string | null;
}

/**
 * Type mapping for event types to their data classes
 */
export type SseEventDataMap = {
  [SseEventType.STATUS]: StatusResponse;
  [SseEventType.ACTIVITY]: ActivityStats;
  [SseEventType.ZIP_PROGRESS]: ZipProgressResponse;
  // Add more mappings here as you add event types
};





