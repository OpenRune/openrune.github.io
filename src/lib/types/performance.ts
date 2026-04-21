export type PerformanceFrameRaw = {
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
};

export type PerformanceSnapshot = {
  timestamp: number;
  osName: string;
  osArch: string;
  osVersion: string;
  javaVersion: string;
  cpuCores: number;
  memoryMaxMiB: number;
  gpuName: string;
  settings: Record<string, string>;
  frames: PerformanceFrameRaw[];
};

export type UploadedPerformanceFile = {
  id: string;
  name: string;
  size: number;
  data: PerformanceSnapshot;
};

export type ProcessedFrame = PerformanceFrameRaw & {
  elapsedMs: number;
  cpuTimeNs: number;
  gpuTimeNs: number;
  bottleneck: "CPU" | "GPU";
  estimatedFps: number;
  timingMap: Record<string, number>;
};
