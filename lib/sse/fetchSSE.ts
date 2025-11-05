'use client';

import React from 'react';
import { SseEventType, SseEventDataMap, SseEvent } from './types';

export type SseEventCallback<T extends SseEventType> = (data: SseEventDataMap[T]) => void;
export type SseErrorCallback = (error: Event | Error) => void;
export type SseConnectCallback = () => void;

export interface SseConnection {
  close: () => void;
  readyState: () => number; // 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
}

/**
 * Connect to SSE endpoint with type-safe event handling
 * 
 * @param type - The SSE event type to filter for
 * @param onEvent - Callback that receives the deserialized data class
 * @param onError - Optional error callback
 * @param onConnect - Optional connect callback
 * @param backendUrl - Optional backend URL (if provided, will extract ip/port and use proxy route)
 * 
 * @example
 * ```typescript
 * const connection = fetchSSE(
 *   SseEventType.STATUS,
 *   (statusResponse: StatusResponse) => {
 *     console.log(statusResponse.status); // Type-safe!
 *     console.log(statusResponse.game);
 *   }
 * );
 * ```
 */
export function fetchSSE<T extends SseEventType>(
  type: T,
  onEvent: SseEventCallback<T>,
  onError?: SseErrorCallback,
  onConnect?: SseConnectCallback,
  backendUrl?: string
): SseConnection | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Use the proxy route - it will handle HTTPS to HTTP conversion
    let sseUrl: string;
    
    if (backendUrl) {
      // Extract ip and port from backendUrl (e.g., "http://localhost:8090" or "http://150.107.201.110:8090")
      try {
        const url = new URL(backendUrl);
        const ip = url.hostname;
        const port = url.port || (url.protocol === 'https:' ? '443' : '80');
        // Use proxy route with ip and port as query parameters
        sseUrl = `/api/server/sse?type=${type}&ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`;
      } catch (e) {
        // If URL parsing fails, fall back to proxy route without ip/port (will use cookie/header)
        sseUrl = `/api/server/sse?type=${type}`;
      }
    } else {
      // No backendUrl provided, use proxy route which will use cookie/header
      sseUrl = `/api/server/sse?type=${type}`;
    }
    
    const eventSource = new EventSource(sseUrl);
    
    // Suppress 404 errors in console by intercepting fetch
    // EventSource doesn't expose fetch options, so we'll handle errors silently in onerror

    eventSource.onopen = () => {

      if (onConnect) {
        onConnect();
      }
    };

    // Handle default message event (when backend sends events without specific event type)
    eventSource.onmessage = (event: MessageEvent) => {

      try {
        const parsed = JSON.parse(event.data);
        
        // Check if it's wrapped in an SseEvent (has type and data properties)
        if (parsed.type && parsed.data) {
          const sseEvent = parsed as SseEvent<SseEventDataMap[T]>;
          
          // Verify the event type matches what we're listening for
          if (sseEvent.type === type) {
   
            onEvent(sseEvent.data);
          }
        } else {
          // Backend sent the data directly (not wrapped), treat it as the data class
 
          onEvent(parsed as SseEventDataMap[T]);
        }
      } catch (error) {
   
        if (onError) {
          onError(error as Error);
        }
      }
    };

    // Listen for lowercase event type (some backends send lowercase)
    eventSource.addEventListener(type.toLowerCase(), (event: Event) => {
      const messageEvent = event as MessageEvent;

      try {
        const parsed = JSON.parse(messageEvent.data);
        
        // Check if it's wrapped in an SseEvent
        if (parsed.type && parsed.data) {
          const sseEvent = parsed as SseEvent<SseEventDataMap[T]>;
          if (sseEvent.type === type) {
  
            onEvent(sseEvent.data);
          }
        } else {
          // Direct data
 
          onEvent(parsed as SseEventDataMap[T]);
        }
      } catch (error) {
  
        if (onError) {
          onError(error as Error);
        }
      }
    });

    // Listen for uppercase event type
    eventSource.addEventListener(type, (event: Event) => {
      const messageEvent = event as MessageEvent;
  
      try {
        const parsed = JSON.parse(messageEvent.data);
        
        // Check if it's wrapped in an SseEvent
        if (parsed.type && parsed.data) {
          const sseEvent = parsed as SseEvent<SseEventDataMap[T]>;
          if (sseEvent.type === type) {

            onEvent(sseEvent.data);
          }
        } else {
          // Direct data

          onEvent(parsed as SseEventDataMap[T]);
        }
      } catch (error) {
        if (onError) {
          onError(error as Error);
        }
      }
    });

    eventSource.onerror = (error: Event) => {
      // Silently handle 404 errors - endpoint doesn't exist for this cache type
      // When EventSource gets a 404, readyState becomes CLOSED immediately
      // Don't call onError for closed connections (404s) - handle them gracefully
      if (eventSource.readyState === EventSource.CLOSED) {
        // Connection closed - likely a 404 or endpoint not available
        // Silently ignore - this is expected for cache types without SSE endpoints
        return;
      }
      
      // Only call onError for other errors (network issues, etc.) while connecting or open
      if (onError && (eventSource.readyState === EventSource.CONNECTING || eventSource.readyState === EventSource.OPEN)) {
        onError(error);
      }
    };

    return {
      close: () => {
    
        eventSource.close();
      },
      readyState: () => {
        return eventSource.readyState;
      },
    };
  } catch (error) {

    if (onError) {
      onError(error as Error);
    }
    return null;
  }
}

/**
 * React hook for SSE connections with type safety
 * 
 * @example
 * ```typescript
 * function MyComponent() {
 *   useSSE(SseEventType.STATUS, (statusResponse: StatusResponse) => {
 *     console.log(statusResponse.status); // Type-safe!
 *   });
 * }
 * ```
 */
export function useSSE<T extends SseEventType>(
  type: T,
  onEvent: SseEventCallback<T>,
  onError?: SseErrorCallback,
  enabled: boolean = true,
  backendUrl?: string
): SseConnection | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const connectionRef = React.useRef<SseConnection | null>(null);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    // Close existing connection if any
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }

    // Create new connection with type-safe deserialization
    connectionRef.current = fetchSSE(type, onEvent, onError, undefined, backendUrl);

    return () => {
      if (connectionRef.current) {
        connectionRef.current.close();
        connectionRef.current = null;
      }
    };
  }, [type, enabled, backendUrl]); // Reconnect if type or enabled changes

  return connectionRef.current;
}

