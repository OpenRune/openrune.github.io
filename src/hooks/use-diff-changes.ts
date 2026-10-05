"use client";

import * as React from "react";

import { streamConfigDiffLines, type DiffChangeProgress } from "@/components/diff/diff-config-changes";
import type { ConfigLine } from "@/components/diff/diff-types";
import type { CacheTarget } from "@/lib/cache-api-client";

export type DiffChangesStatus = "idle" | "loading" | "streaming" | "ok" | "error";

export type DiffChangesState = {
  lines: ConfigLine[];
  progress: DiffChangeProgress | null;
  status: DiffChangesStatus;
  error: string | null;
};

const IDLE: DiffChangesState = { lines: [], progress: null, status: "idle", error: null };
const EMPTY_DIFF: DiffChangesState = { lines: [], progress: null, status: "ok", error: null };

export type UseDiffChangesOptions = {
  cacheType: CacheTarget;
  configType: string;
  base: number;
  rev: number;
  enabled: boolean;
  headerLabelForId?: (id: number) => string | undefined;
};

/**
 * Loads a config diff page by page, rendering the first page as soon as it arrives and streaming
 * the rest in behind it.
 */
export function useDiffChanges(options: UseDiffChangesOptions): DiffChangesState {
  const { cacheType, configType, base, rev, enabled, headerLabelForId } = options;
  const [state, setState] = React.useState<DiffChangesState>(IDLE);

  // Held in a ref so a new label lookup identity does not restart an in-flight stream; only
  // gaining or losing the lookup entirely is worth reloading for.
  const headerLabelRef = React.useRef(headerLabelForId);
  headerLabelRef.current = headerLabelForId;
  const hasHeaderLabels = headerLabelForId != null;

  React.useEffect(() => {
    if (!enabled) {
      setState(IDLE);
      return;
    }
    if (base === rev) {
      setState(EMPTY_DIFF);
      return;
    }

    const ac = new AbortController();
    setState({ ...IDLE, status: "loading" });

    void streamConfigDiffLines({
      cacheType,
      configType,
      base,
      rev,
      signal: ac.signal,
      headerLabelForId: hasHeaderLabels ? (id) => headerLabelRef.current?.(id) : undefined,
      onBatch: (batch, progress) => {
        setState((prev) => ({
          lines: batch.length > 0 ? prev.lines.concat(batch) : prev.lines,
          progress,
          status: progress.done ? "ok" : "streaming",
          error: null,
        }));
      },
    }).catch((e: unknown) => {
      if (ac.signal.aborted) return;
      setState((prev) => ({
        ...prev,
        status: "error",
        error: e instanceof Error ? e.message : "Failed to load config diff",
      }));
    });

    return () => ac.abort();
  }, [cacheType, configType, base, rev, enabled, hasHeaderLabels]);

  return state;
}
