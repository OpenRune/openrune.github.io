"use client";

import type { CacheTarget } from "@/lib/cache-api-target";
import type { SseEvent, SseEventDataMap, SseEventType } from "@/lib/sse/types";

export type SseEventCallback<T extends SseEventType> = (
  data: SseEventDataMap[T],
) => void;
export type SseErrorCallback = (error: Event | Error) => void;

export interface SseConnection {
  close: () => void;
  readyState: () => number;
}

function buildSseUrl(type: SseEventType, cacheType?: CacheTarget): string | null {
  if (!cacheType) return null;

  const search = new URLSearchParams({
    type,
    _host: cacheType.ip.trim(),
    _port: String(cacheType.port),
  });
  return `/api/cache/sse?${search.toString()}`;
}

function parseSsePayload<T extends SseEventType>(
  payload: string,
  expectedType: T,
): SseEventDataMap[T] | null {
  const parsed = JSON.parse(payload) as SseEvent<SseEventDataMap[T]> | SseEventDataMap[T];

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "type" in parsed &&
    "data" in parsed
  ) {
    const wrapped = parsed as SseEvent<SseEventDataMap[T]>;
    return wrapped.type === expectedType ? wrapped.data : null;
  }

  return parsed as SseEventDataMap[T];
}

export function fetchSSE<T extends SseEventType>(
  type: T,
  onEvent: SseEventCallback<T>,
  onError?: SseErrorCallback,
  cacheType?: CacheTarget,
): SseConnection | null {
  if (typeof window === "undefined") return null;

  const sseUrl = buildSseUrl(type, cacheType);
  if (!sseUrl) return null;

  try {
    const source = new EventSource(sseUrl);

    const handleMessage = (payload: string) => {
      try {
        const eventData = parseSsePayload(payload, type);
        if (eventData !== null) {
          onEvent(eventData);
        }
      } catch (err) {
        onError?.(err as Error);
      }
    };

    source.onmessage = (event) => handleMessage(event.data);

    source.addEventListener(type.toLowerCase(), (event: Event) => {
      handleMessage((event as MessageEvent).data);
    });
    source.addEventListener(type, (event: Event) => {
      handleMessage((event as MessageEvent).data);
    });

    source.onerror = (event) => {
      if (source.readyState === EventSource.CLOSED) return;
      onError?.(event);
    };

    return {
      close: () => source.close(),
      readyState: () => source.readyState,
    };
  } catch (err) {
    onError?.(err as Error);
    return null;
  }
}
