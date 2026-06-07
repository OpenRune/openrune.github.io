import type { ReactNode } from "react";

export interface CacheType {
  id: string;
  name: string;
  ip: string;
  port: number;
  image?: string;
  icon?: ReactNode;
  description: string;
}

export const BASE_CACHE_TYPES: CacheType[] = [
  {
    id: "osrs",
    name: "OSRS",
    ip: "osrs.openrune.dev",
    port: 8090,
    image: "/cache-osrs.png",
    description: "Old School RuneScape cache server",
  },
  {
    id: "rs3",
    name: "RS3",
    ip: "rs3.openrune.dev",
    port: 2034,
    image: "/cache-rs3.png",
    description: "RuneScape 3 cache server",
  },
];

export const LOCALHOST_CACHE_TYPE: CacheType = {
  id: "localhost",
  name: "Localhost",
  ip: "localhost",
  port: 8090,
  image: "/globe.svg",
  description: "Local development cache server",
};

export const STORAGE_KEY = "selected-cache-type";
export const LOCAL_STORAGE_KEY = "cache-type-manually-selected";
