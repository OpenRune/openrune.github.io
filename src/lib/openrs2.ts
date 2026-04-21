type OpenRs2Build = {
  major: number;
  minor: number | null;
};

type OpenRs2Cache = {
  id: number;
  game: string;
  environment: string;
  timestamp: string;
  builds: OpenRs2Build[];
  indexes: number | null;
  valid_indexes: number | null;
  groups: number | null;
  valid_groups: number | null;
  keys: number | null;
  valid_keys: number | null;
  sources: string[] | null;
  size: number;
};

export type CurrentRevisionInfo = {
  game: "OLDSCHOOL" | "RUNESCAPE";
  revision: number;
  subRevision: number;
  archiveId: number;
  environment: string;
  size: number;
  timestamp: string;
};

export type CurrentRevisionSnapshot = {
  updatedAt: string;
  oldschool: CurrentRevisionInfo | null;
  runescape: CurrentRevisionInfo | null;
};

export type CacheArchiveRow = {
  id: number;
  game: string;
  environment: string;
  timestamp: string;
  builds: OpenRs2Build[];
  archives: number | null;
  validArchives: number | null;
  groups: number | null;
  validGroups: number | null;
  keys: number | null;
  validKeys: number | null;
  size: number;
  sources: string[];
  links: {
    details: string;
    disk: string;
    keys: string;
    flatFile: string;
    keysText: string;
    map: string;
  };
};

const OPENRS2_CACHES_URL = "https://archive.openrs2.org/caches.json";

function parseTimestampMs(value: string): number {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

async function fetchAllCaches(): Promise<OpenRs2Cache[]> {
  const response = await fetch(OPENRS2_CACHES_URL, {
    method: "GET",
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenRS2 caches: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as OpenRs2Cache[];
}

function pickLatestLiveRevision(
  caches: OpenRs2Cache[],
  gameToken: "oldschool" | "runescape",
): CurrentRevisionInfo | null {
  const candidates = caches
    .filter((cache) => cache.environment === "live")
    .filter((cache) => cache.builds?.length > 0)
    .filter((cache) => cache.timestamp && parseTimestampMs(cache.timestamp) > 0)
    .filter((cache) => cache.game.toLowerCase().includes(gameToken));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => parseTimestampMs(a.timestamp) - parseTimestampMs(b.timestamp));
  const latest = candidates[candidates.length - 1];
  const build = latest.builds[0] ?? { major: 0, minor: 0 };
  const inferredSubRevision =
    gameToken === "oldschool"
      ? candidates.filter((cache) => (cache.builds[0]?.major ?? 0) === build.major).length
      : (build.minor ?? 0);

  return {
    game: gameToken === "oldschool" ? "OLDSCHOOL" : "RUNESCAPE",
    revision: build.major,
    subRevision: inferredSubRevision,
    archiveId: latest.id,
    environment: latest.environment,
    size: latest.size,
    timestamp: latest.timestamp,
  };
}

export async function getCurrentRevisionSnapshot(): Promise<CurrentRevisionSnapshot> {
  const caches = await fetchAllCaches();

  return {
    updatedAt: new Date().toISOString(),
    oldschool: pickLatestLiveRevision(caches, "oldschool"),
    runescape: pickLatestLiveRevision(caches, "runescape"),
  };
}

export async function getCacheArchiveRows(): Promise<CacheArchiveRow[]> {
  const caches = await fetchAllCaches();

  return caches
    .map((cache) => ({
      id: cache.id,
      game: cache.game,
      environment: cache.environment,
      timestamp: cache.timestamp,
      builds: cache.builds ?? [],
      archives: cache.indexes ?? null,
      validArchives: cache.valid_indexes ?? null,
      groups: cache.groups ?? null,
      validGroups: cache.valid_groups ?? null,
      keys: cache.keys ?? null,
      validKeys: cache.valid_keys ?? null,
      size: cache.size ?? 0,
      sources: Array.isArray(cache.sources) ? cache.sources : [],
      links: {
        details: `https://archive.openrs2.org/caches/${cache.id}`,
        disk: `https://archive.openrs2.org/caches/runescape/${cache.id}/disk.zip`,
        keys: `https://archive.openrs2.org/caches/runescape/${cache.id}/keys.json`,
        flatFile: `https://archive.openrs2.org/caches/runescape/${cache.id}/flat-file.tar.gz`,
        keysText: `https://archive.openrs2.org/caches/runescape/${cache.id}/keys.zip`,
        map: `https://archive.openrs2.org/caches/runescape/${cache.id}/map.png`,
      },
    }))
    .sort((a, b) => parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp));
}
