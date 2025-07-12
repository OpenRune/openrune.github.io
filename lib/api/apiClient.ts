import axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios'

// Axios instance with credentials
export const apiClient: AxiosInstance = axios.create({
    baseURL: '/api/',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
})

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
