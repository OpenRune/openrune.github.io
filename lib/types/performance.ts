export interface FrameData {
  timestamp: number;
  drawnTiles: number;
  drawnStatic: number;
  drawnDynamic: number;
  npcDisplacementCacheSize: number;
  memoryUsed: number;
  memoryTotal: number;
  memoryFree: number;
  memoryMax: number;
  cpu: Record<string, number>;
  gpu: Record<string, number>;
  // Computed fields
  elapsed?: number;
  bottleneck?: string;
  estimatedFps?: number;
  cpuTime?: number;
  gpuTime?: number;
  timingMap?: Record<string, number>;
}

export interface SnapshotData {
  timestamp: number;
  osName: string;
  osArch: string;
  osVersion: string;
  javaVersion: string;
  cpuCores: number;
  memoryMaxMiB: number;
  gpuName: string;
  settings: Record<string, string>;
  frames: FrameData[];
}

export interface UploadedFile {
  name: string;
  data: SnapshotData;
  size: number;
}

export interface SummaryStats {
  totalFrames: number;
  avgFps: string;
  avgCpuTime: string;
  avgGpuTime: string;
  avgMemoryUsed: string;
  avgDrawnTiles: number;
  avgDrawnStatic: number;
  avgDrawnDynamic: number;
  avgNpcCacheSize: number;
  bottlenecks: Record<string, number>;
} 