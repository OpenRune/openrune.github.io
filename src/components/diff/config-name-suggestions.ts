"use client";

import * as React from "react";

import { configNamesUrl, type CacheTarget } from "@/lib/cache-api-client";
import { conditionalJsonFetch } from "@/lib/openrune-idb-cache";

export type ConfigNameAutocompleteConfig = {
  cacheType: CacheTarget;
  /** Config type key, e.g. `items`. */
  configType: string;
  rev: number;
  enabled: boolean;
};

export type ConfigNameSuggestion = { name: string; id: number };

type NameEntry = ConfigNameSuggestion & { lowerName: string };

const LIMIT = 30;

/**
 * One in-flight/last-result cache per type+revision, shared across every field on the page.
 * Published revisions are immutable, so an entry never needs invalidating.
 */
const cache = new Map<string, Promise<NameEntry[]>>();

function cacheKey(config: ConfigNameAutocompleteConfig): string {
  return `${config.cacheType.ip}:${config.cacheType.port}:${config.configType}:${config.rev}`;
}

function parseNames(raw: unknown): NameEntry[] {
  if (!raw || typeof raw !== "object") return [];
  const names = (raw as { names?: unknown }).names;
  if (!names || typeof names !== "object") return [];
  const out: NameEntry[] = [];
  for (const [key, value] of Object.entries(names as Record<string, unknown>)) {
    const id = Number.parseInt(key, 10);
    if (!Number.isFinite(id) || typeof value !== "string") continue;
    const name = value.trim();
    if (!name) continue;
    out.push({ id, name, lowerName: name.toLowerCase() });
  }
  return out;
}

function loadNames(config: ConfigNameAutocompleteConfig): Promise<NameEntry[]> {
  const key = cacheKey(config);
  const existing = cache.get(key);
  if (existing) return existing;
  const url = configNamesUrl(config.cacheType, config.configType, config.rev);
  const promise = conditionalJsonFetch<unknown>(`config:names:${key}`, url)
    .then(({ data }) => parseNames(data))
    .catch(() => {
      // Let a later attempt retry rather than caching the failure forever.
      cache.delete(key);
      return [] as NameEntry[];
    });
  cache.set(key, promise);
  return promise;
}

function filterNameSuggestions(entries: NameEntry[], rawQuery: string): ConfigNameSuggestion[] {
  const q = rawQuery.trim().toLowerCase();
  if (q.length === 0) return [];
  return entries
    .filter((e) => e.lowerName.includes(q) || String(e.id).includes(q))
    .sort((a, b) => {
      // Prefix matches first, then id matches, then alphabetical.
      const as = a.lowerName.startsWith(q) ? 0 : String(a.id).startsWith(q) ? 1 : 2;
      const bs = b.lowerName.startsWith(q) ? 0 : String(b.id).startsWith(q) ? 1 : 2;
      if (as !== bs) return as - bs;
      const byName = a.name.localeCompare(b.name);
      return byName !== 0 ? byName : a.id - b.id;
    })
    .slice(0, LIMIT)
    .map(({ name, id }) => ({ name, id }));
}

/**
 * Name suggestions for a config type, filtered in the browser from a set fetched once per
 * revision — the same shape as gameval suggestions, so typing never waits on the network.
 * Loading starts as soon as the search field exists, not on the first keystroke.
 */
export function useConfigNameSuggestions(
  config: ConfigNameAutocompleteConfig | null | undefined,
  value: string,
  active: boolean,
) {
  const [entries, setEntries] = React.useState<NameEntry[] | null>(null);

  const enabled = Boolean(config?.enabled);
  const key = config && enabled ? cacheKey(config) : null;

  React.useEffect(() => {
    if (!config || !enabled) {
      setEntries(null);
      return;
    }
    let cancelled = false;
    setEntries(null);
    void loadNames(config).then((loaded) => {
      if (!cancelled) setEntries(loaded);
    });
    return () => {
      cancelled = true;
    };
    // `key` covers every field of `config` that changes the request.
  }, [key, enabled]);

  const suggestions = React.useMemo(
    () => (active && entries ? filterNameSuggestions(entries, value) : []),
    [active, entries, value],
  );

  return { suggestions, loading: enabled && entries === null, loaded: entries !== null };
}
