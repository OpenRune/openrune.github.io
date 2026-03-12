import type {
  PerformanceFrameRaw,
  PerformanceSnapshot,
  ProcessedFrame,
  UploadedPerformanceFile,
} from "@/lib/types/performance";

export function isPerformanceSnapshot(value: unknown): value is PerformanceSnapshot {
  if (typeof value !== "object" || value == null) return false;
  const candidate = value as Partial<PerformanceSnapshot>;
  return Array.isArray(candidate.frames) && typeof candidate.settings === "object";
}

export function processFrames(
  frames: PerformanceFrameRaw[] | undefined,
  frameLimit: number | "all",
): ProcessedFrame[] {
  if (!Array.isArray(frames) || frames.length === 0) return [];
  const selectedFrames = frameLimit === "all" ? frames : frames.slice(0, frameLimit);
  const firstTimestamp = selectedFrames[0]?.timestamp ?? 0;

  return selectedFrames.map((frame) => {
    const cpuTimeNs = Object.values(frame.cpu ?? {}).reduce((sum, value) => sum + (value || 0), 0);
    const gpuTimeNs = Object.values(frame.gpu ?? {}).reduce((sum, value) => sum + (value || 0), 0);
    const totalFrameNs = cpuTimeNs + gpuTimeNs;

    return {
      ...frame,
      elapsedMs: (frame.timestamp - firstTimestamp) / 1_000_000,
      cpuTimeNs,
      gpuTimeNs,
      bottleneck: cpuTimeNs > gpuTimeNs ? "CPU" : "GPU",
      estimatedFps: totalFrameNs > 0 ? 1_000_000_000 / totalFrameNs : 0,
      timingMap: { ...(frame.cpu ?? {}), ...(frame.gpu ?? {}) },
    };
  });
}

export function collectTimingKeys(frames: ProcessedFrame[]): string[] {
  const keys = new Set<string>();
  for (const frame of frames) {
    for (const key of Object.keys(frame.timingMap)) {
      keys.add(key);
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

async function parseFile(file: File): Promise<UploadedPerformanceFile | null> {
  return new Promise<UploadedPerformanceFile | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        if (!isPerformanceSnapshot(json)) {
          resolve(null);
          return;
        }
        resolve({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          size: file.size,
          data: json,
        });
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

export async function parseJsonFiles(
  files: FileList | null,
  maxFiles: number,
): Promise<UploadedPerformanceFile[]> {
  if (!files) return [];
  const selected = Array.from(files).slice(0, maxFiles);
  const parsed = await Promise.all(selected.map((file) => parseFile(file)));

  return parsed.filter((entry): entry is UploadedPerformanceFile => Boolean(entry));
}

export async function parseJsonFile(file: File): Promise<UploadedPerformanceFile | null> {
  return parseFile(file);
}
