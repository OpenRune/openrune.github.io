import axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios'
import { CacheType } from '@/lib/cacheTypes'

// Cache type storage
let currentCacheType: CacheType | null = null;

export function setCacheType(cacheType: CacheType) {
    currentCacheType = cacheType;
}

export function getCacheType(): CacheType | null {
    return currentCacheType;
}

// Wrapper around fetch that automatically includes cache type header and cookie
export async function fetchWithCacheType(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> {
    const headers = new Headers(init?.headers);
    
    // Add cache type header and cookie if available
    if (currentCacheType && typeof window !== 'undefined') {
        const cacheTypeStr = JSON.stringify({
            ip: currentCacheType.ip,
            port: currentCacheType.port
        });
        headers.set('x-cache-type', cacheTypeStr);
        // Also set cookie for server-side access (e.g., when Three.js loads images)
        document.cookie = `cache-type=${cacheTypeStr}; path=/; max-age=31536000`;
    }
    
    // Disable caching in development/local
    const isDev = process.env.NODE_ENV === 'development' || 
                  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
    
    if (isDev) {
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');
    }
    
    // Merge with any existing headers
    return fetch(input, {
        ...init,
        headers,
        cache: isDev ? 'no-store' : init?.cache
    });
}

// Build URL and fetch in one call with automatic cache type header
export async function fetchFromBuildUrl(
    path: string,
    queryParams: Record<string, string | number | boolean | null | undefined> = {},
    init?: RequestInit
): Promise<Response> {
    const url = buildUrl(path, queryParams);
    return fetchWithCacheType(url, init);
}

// Axios instance with credentials
export const apiClient: AxiosInstance = axios.create({
    baseURL: '/api/',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Interceptor to add cache type to requests and disable caching in dev
apiClient.interceptors.request.use((config) => {
    if (currentCacheType && typeof window !== 'undefined') {
        const cacheTypeStr = JSON.stringify({
            ip: currentCacheType.ip,
            port: currentCacheType.port
        });
        // Store cache type in header and cookie for server-side access
        config.headers['x-cache-type'] = cacheTypeStr;
        // Also set cookie for consistency
        document.cookie = `cache-type=${cacheTypeStr}; path=/; max-age=31536000`;
    }
    
    // Disable caching in development/local
    const isDev = process.env.NODE_ENV === 'development' || 
                  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
    
    if (isDev) {
        config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        config.headers['Pragma'] = 'no-cache';
        config.headers['Expires'] = '0';
    }
    
    return config;
});

// Build a full URL with optional query parameters
export function buildUrl(
    path: string,
    queryParams: Record<string, string | number | boolean | null | undefined> = {}
): string {
    const base = apiClient.defaults.baseURL || '/'
    const baseOrigin = base.startsWith('http')
        ? base
        : typeof window !== 'undefined'
          ? window.location.origin
          : '';

    const basePath = base.endsWith('/') ? base.slice(0, -1) : base
    const normalizedPath = path.startsWith('/') ? path : '/' + path
    const fullPath = basePath + normalizedPath

    let url: URL;
    if (baseOrigin) {
        url = new URL(fullPath, baseOrigin);
    } else {
        // If baseOrigin is empty (server-side with relative baseURL),
        // we assume fullPath is already correct relative path.
        // Append query parameters manually.
        let resultUrl = fullPath;
        const queryString = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryString.append(key, String(value));
            }
        });
        if (queryString.toString()) {
            resultUrl += '?' + queryString.toString();
        }
        return resultUrl;
    }

    Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value))
        }
    })

    return url.toString()
}

// Unauthorized request (no cookies)
export const unauthorizedRequest = <T = unknown>(
    options: AxiosRequestConfig
): Promise<AxiosResponse<T>> => {
    return axios({
        ...options,
        baseURL: '/api/',
        withCredentials: false,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    })
}

// Common config builder
function buildOptions(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: unknown,
    responseType: 'json' | 'text' = 'json',
    headers: Record<string, string> = {}
): AxiosRequestConfig {
    return {
        method,
        url,
        data,
        responseType,
        headers: {
            'Content-Type': responseType === 'json' ? 'application/json' : 'text/plain',
            ...headers,
        },
    }
}

// Unauthorized HTTP shortcuts
export const unauthorized = {
    get: <T = unknown>(url: string, responseType: 'json' | 'text' = 'json', headers: Record<string, string> = {}) =>
        unauthorizedRequest<T>(buildOptions('get', url, undefined, responseType, headers)),

    post: <T = unknown>(url: string, data?: unknown, responseType: 'json' | 'text' = 'json', headers: Record<string, string> = {}) =>
        unauthorizedRequest<T>(buildOptions('post', url, data, responseType, headers)),

    put: <T = unknown>(url: string, data?: unknown, responseType: 'json' | 'text' = 'json', headers: Record<string, string> = {}) =>
        unauthorizedRequest<T>(buildOptions('put', url, data, responseType, headers)),

    delete: <T = unknown>(url: string, data?: unknown, responseType: 'json' | 'text' = 'json', headers: Record<string, string> = {}) =>
        unauthorizedRequest<T>(buildOptions('delete', url, data, responseType, headers)),
}
