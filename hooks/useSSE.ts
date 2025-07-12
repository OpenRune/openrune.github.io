import { useEffect, useRef } from 'react';

import { NativeEventSource, EventSourcePolyfill } from 'event-source-polyfill';

export function useSSE<T = any>(
  url: string,
  eventName: string | null,
  onEvent: (data: T, event: MessageEvent) => void,
  options?: { reconnectIntervalMs?: number }
) {

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Do not attempt to connect if no url was provided
    if (!url) {
      return;
    }

    let isMounted = true;
    function connect() {
      if (!isMounted) return;
      const eventSource = new EventSourcePolyfill(url, {
        withCredentials: true
      });
      eventSourceRef.current = eventSource;

      const handler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(data, event);
        } catch (e) {
          // If not JSON, pass as string
          onEvent(event.data as any, event);
        }
      };

      if (eventName) {
        // Cast to any to satisfy EventSource typings for custom event names
        eventSource.addEventListener(eventName as any, handler as any);
      } else {
        eventSource.onmessage = handler as any;
      }

      eventSource.onerror = (err) => {
        if (eventSource.readyState === 2) {
          // Closed
          if (isMounted && options?.reconnectIntervalMs) {
            reconnectTimeoutRef.current = setTimeout(connect, options.reconnectIntervalMs);
          }
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, eventName]);
} 