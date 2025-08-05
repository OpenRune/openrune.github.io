export interface FrameData {
  elapsed: number;
  currentTime: number;
  drawnTiles: number;
  drawnStatic: number;
  drawnDynamic: number;
  npcCacheSize: number;
  timings: number[];
  bottleneck: string;
  estimatedFps: number;
  cpuTime: number;
  gpuTime: number;
  timingMap: Record<string, number>;
  memoryUsed: number;
  memoryTotal: number;
  memoryFree: number;
  memoryMax: number;
}

export interface UploadedFile {
  name: string;
  data: any;
  size: number;
}

export interface SummaryStats {
  totalFrames: number;
  avgFps: string;
  avgCpuTime: string;
  avgGpuTime: string;
  avgMemoryUsed: string;
  avgDrawnTiles: number;
  bottlenecks: Record<string, number>;
} 