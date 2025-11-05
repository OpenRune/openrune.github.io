// Request deduplication utility to prevent duplicate API calls
const pendingRequests = new Map<string, Promise<any>>();

export function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  const existing = pendingRequests.get(key);
  if (existing) {
    return existing;
  }

  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

// Create a cache key from endpoint and params
export function createCacheKey(endpoint: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&');
  return `${endpoint}?${sortedParams}`;
}


