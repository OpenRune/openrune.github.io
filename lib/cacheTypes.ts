import { ReactNode } from 'react';

export interface CacheType {
  id: string;
  name: string;
  ip: string;
  port: number;
  image?: string; // URL or path to image (PNG/SVG)
  icon?: ReactNode; // React icon component (e.g., from @tabler/icons-react)
  description: string;
}

export const BASE_CACHE_TYPES: CacheType[] = [
  {
    id: 'osrs',
    name: 'OSRS',
    ip: '150.107.201.110',
    port: 8090,
    image: '/cache-osrs.png',
    description: 'Old School RuneScape cache server',
  },
  {
    id: 'sailing',
    name: 'Sailing',
    ip: '150.107.201.110',
    port: 8091,
    image: '/cache-sailing.png',
    description: 'Sailing cache server',
  },
  {
    id: 'rs3',
    name: 'RS3',
    ip: '150.107.201.110',
    port: 8092,
    image: '/cache-rs3.png',
    description: 'RuneScape 3 cache server',
  },
];

export const LOCALHOST_CACHE_TYPE: CacheType = {
  id: 'localhost',
  name: 'Localhost',
  ip: 'localhost',
  port: 8090,
  image: '/cache-localhost.png',
  description: 'Local development cache server',
};

export const STORAGE_KEY = 'selected-cache-type';
export const LOCAL_STORAGE_KEY = 'cache-type-manually-selected'; // Track if user manually selected

