"use client";

import * as React from "react";

import { useCacheType } from "@/context/cache-type-context";
import { cacheProxyHeaders, diffConfigContentUrl } from "@/lib/cache-proxy-client";

import {
  configLinesFromContentPayload,
  parseConfigContentToRows,
  sequenceLengthInCyclesByIdFromRows,
} from "./diff-config-content";

/**
 * Fetches `sequences` config content and builds `animationId` → `lengthInCycles` for spotanim tick duration.
 */
export function useSpotanimSequenceTicks(enabled: boolean, base: number, rev: number) {
  const { selectedCacheType } = useCacheType();
  const [ticksById, setTicksById] = React.useState<Record<number, number>>({});

  React.useEffect(() => {
    if (!enabled) {
      setTicksById({});
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const url = diffConfigContentUrl("sequences", { base, rev });
        const response = await fetch(url, {
          cache: "no-store",
          headers: cacheProxyHeaders(selectedCacheType),
        });
        if (cancelled) return;
        if (!response.ok) {
          setTicksById({});
          return;
        }
        const data: unknown = await response.json();
        if (cancelled) return;
        const lines = configLinesFromContentPayload(data);
        if (lines == null) {
          setTicksById({});
          return;
        }
        const seqRows = parseConfigContentToRows(lines);
        if (!cancelled) setTicksById(sequenceLengthInCyclesByIdFromRows(seqRows));
      } catch {
        if (!cancelled) setTicksById({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, base, rev, selectedCacheType.id, selectedCacheType.ip, selectedCacheType.port]);

  return ticksById;
}
