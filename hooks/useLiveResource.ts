import React, { useState } from 'react';
import { useSSE } from './useSSE';
import {authorized} from "@/lib/api/apiClient";

export interface RawSSEEvent {
  id?: string;
  event?: string;
  data: any;
}

interface UseLiveResourceOptions<T = any> {
  fetchUrl: string;
  eventName: string | null;
  reconnectIntervalMs?: number;
  onFail?: (errorMessage: string) => void;
  onMessage?: (data: T, event: MessageEvent) => void;
  responseType?: 'json' | 'raw';
  /**
   * If false, the hook will skip the initial fetch and SSE subscription.
   * Useful when you always want to pass the same URLs but only sometimes
   * activate the live resource logic.
   */
  shouldProcess?: boolean;
}

export function useLiveResourceJson<T>(options: Omit<Parameters<typeof useLiveResource<T>>[0], 'responseType'>) {
  return useLiveResource<T>({ ...options, responseType: 'json' });
}

export function useLiveResourceRaw(options: Omit<Parameters<typeof useLiveResource>[0], 'responseType'>) {
  return useLiveResource<RawSSEEvent>({ ...options, responseType: 'raw' });
}

export function useLiveResource<T = any>({
  fetchUrl,
  eventName,
  reconnectIntervalMs,
  onFail,
  onMessage,
  responseType = 'json',
  shouldProcess = true,
}: UseLiveResourceOptions<T>) {
  const [data, setData] = useState<T | RawSSEEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data (only if a fetchUrl is provided)
  React.useEffect(() => {
    if (!shouldProcess || !fetchUrl) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    console.log(fetchUrl);

    fetch(fetchUrl)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          setError(errorMsg);
          setLoading(false);
          if (onFail) onFail(errorMsg);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchUrl, onFail, shouldProcess]);

  // Construct SSE URL only when eventName is provided
  const eventUrl = shouldProcess && eventName ? `http://localhost:8080/events/${eventName}` : '';

  useSSE<any>(
    eventUrl,
    shouldProcess ? eventName : null,
    (newData, event) => {
      if (responseType === 'raw') {
        // Try to extract id/event/data from the event
        let raw: RawSSEEvent = {
          id: (event as any).lastEventId,
          event: event.type,
          data: undefined,
        };
        try {
          raw.data = typeof newData === 'string' ? JSON.parse(newData) : newData;
        } catch {
          raw.data = newData;
        }
        setData(raw);
        if (onMessage) onMessage(raw as any, event);
      } else {
        setData(newData);
        if (onMessage) onMessage(newData, event);
      }
    },
    { reconnectIntervalMs }
  );

  return { data, loading, error };
} 